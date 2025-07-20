import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, LessThan } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { Escrow, EscrowStatus } from './escrow.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { CreateEscrowDto } from './dto/create-escrow.dto';
import { ConfirmReceiptDto, InitiateDisputeDto, ResolveDisputeDto, ReleasePartialDto } from './dto/update-escrow.dto';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';

// Define the ReleaseEscrowDto interface based on the test usage
interface ReleaseEscrowDto {
  escrowId: string;
  buyerSignature: string;
}

// Define the PartialReleaseDto interface
interface PartialReleaseDto {
  escrowId: string;
  amount: number;
  recipientAddress: string;
  reason?: string;
}

// Define the DisputeEscrowDto interface
interface DisputeEscrowDto {
  escrowId: string;
  reason: string;
  initiatorSignature: string;
}

// Mock services - these should be replaced with actual implementations
class StellarService {
  async lockFunds(buyerAddress: string, sellerAddress: string, amount: number, escrowId: string): Promise<string> {
    // Mock implementation
    return 'stellar-tx-hash-' + escrowId;
  }

  async releaseFunds(escrowId: string, recipientAddress: string, amount: number): Promise<string> {
    // Mock implementation
    return 'stellar-release-tx-' + escrowId;
  }
}

class AuditService {
  logEscrowEvent(operation: string, escrowId: string, details: string): void {
    // Mock implementation
    console.log(`[AUDIT] ${operation} - Escrow: ${escrowId} - ${details}`);
  }
}

@Injectable()
export class EscrowService {
  private readonly logger = new Logger(EscrowService.name);
  private readonly autoReleaseTimeout: number;
  private readonly stellarService = new StellarService();
  private readonly auditService = new AuditService();

  constructor(
    @InjectRepository(Escrow)
    private readonly escrowRepository: Repository<Escrow>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {
    this.autoReleaseTimeout = this.configService.get<number>('ESCROW_AUTO_RELEASE_TIMEOUT', 86400); // Default 24 hours
  }

  /**
   * Creates new escrow and locks funds
   */
  async createEscrow(createEscrowDto: CreateEscrowDto): Promise<Escrow> {
    return this.dataSource.transaction(async (entityManager) => {
      // Validate transaction exists
      const transaction = await entityManager.findOne(Transaction, {
        where: { id: createEscrowDto.transactionId },
        lock: { mode: 'pessimistic_write' }
      });

      if (!transaction) {
        throw new Error('Transaction not found');
      }

      // Create escrow record
      const escrow = entityManager.create(Escrow, {
        transactionId: createEscrowDto.transactionId,
        amount: createEscrowDto.amount,
        status: EscrowStatus.PENDING,
        timeoutAt: new Date(Date.now() + (createEscrowDto.timeoutHours || 24) * 60 * 60 * 1000),
        version: 1,
      });

      await entityManager.save(escrow);

      try {
        // Lock funds on Stellar
        const lockTxHash = await this.stellarService.lockFunds(
          createEscrowDto.buyerAddress,
          createEscrowDto.sellerAddress,
          createEscrowDto.amount,
          escrow.id
        );

        // Update escrow status
        escrow.status = EscrowStatus.LOCKED;
        await entityManager.save(escrow);

        // Schedule auto-release
        this.scheduleAutoRelease(escrow.id, escrow.timeoutAt);

        this.auditService.logEscrowEvent(
          'CREATE',
          escrow.id,
          `Escrow created and funds locked. Stellar TX: ${lockTxHash}`
        );

        return escrow;
      } catch (error) {
        this.logger.error(`Failed to lock funds: ${error.message}`);
        await entityManager.delete(Escrow, escrow.id);
        throw new Error('Failed to create escrow');
      }
    });
  }

  /**
   * Releases funds to seller upon buyer confirmation
   */
  async releaseFunds(releaseEscrowDto: ReleaseEscrowDto): Promise<string> {
    return this.dataSource.transaction(async (entityManager) => {
      const escrow = await entityManager.findOne(Escrow, {
        where: { id: releaseEscrowDto.escrowId },
        lock: { mode: 'pessimistic_write' }
      });

      if (!escrow) {
        throw new Error('Escrow not found');
      }

      if (!escrow.canTransitionTo(EscrowStatus.RELEASED)) {
        throw new Error('Invalid escrow status for release');
      }

      const transaction = await this.transactionRepository.findOne({
        where: { id: escrow.transactionId }
      });

      if (!transaction) {
        throw new Error('Transaction not found');
      }

      // Validate buyer signature (skip for auto-release)
      if (releaseEscrowDto.buyerSignature !== 'AUTO_RELEASE') {
        // Add proper signature validation logic here
        const expectedSignature = (transaction as any).buyerSignature;
        if (releaseEscrowDto.buyerSignature !== expectedSignature) {
          throw new Error('Invalid buyer confirmation');
        }
      }

      try {
        const releaseTxHash = await this.stellarService.releaseFunds(
          escrow.id,
          (transaction as any).sellerAddress || 'default-seller-address',
          escrow.amount
        );

        escrow.status = EscrowStatus.RELEASED;
        escrow.releasedAt = new Date();
        escrow.releasedTo = (transaction as any).sellerAddress || 'default-seller-address';
        await entityManager.save(escrow);

        this.auditService.logEscrowEvent(
          'RELEASE',
          escrow.id,
          `Funds released to seller. Stellar TX: ${releaseTxHash}`
        );

        this.cancelAutoRelease(escrow.id);

        return releaseTxHash;
      } catch (error) {
        this.logger.error(`Funds release failed: ${error.message}`);
        throw new Error('Failed to release funds');
      }
    });
  }

  /**
   * Handles partial fund release
   */
  async handlePartialRelease(partialReleaseDto: PartialReleaseDto): Promise<string> {
    return this.dataSource.transaction(async (entityManager) => {
      const escrow = await entityManager.findOne(Escrow, {
        where: { id: partialReleaseDto.escrowId },
        lock: { mode: 'pessimistic_write' }
      });

      if (!escrow) {
        throw new Error('Escrow not found');
      }

      if (partialReleaseDto.amount > escrow.amount) {
        throw new Error('Partial release amount exceeds escrow amount');
      }

      const releaseTxHash = await this.stellarService.releaseFunds(
        escrow.id,
        partialReleaseDto.recipientAddress,
        partialReleaseDto.amount
      );

      // Update escrow amount
      escrow.amount -= partialReleaseDto.amount;
      await entityManager.save(escrow);

      this.auditService.logEscrowEvent(
        'PARTIAL_RELEASE',
        escrow.id,
        `Partial release of ${partialReleaseDto.amount}. Stellar TX: ${releaseTxHash}`
      );

      return releaseTxHash;
    });
  }

  /**
   * Initiates dispute resolution
   */
  async initiateDispute(disputeEscrowDto: DisputeEscrowDto): Promise<Escrow> {
    return this.dataSource.transaction(async (entityManager) => {
      const escrow = await entityManager.findOne(Escrow, {
        where: { id: disputeEscrowDto.escrowId },
        lock: { mode: 'pessimistic_write' }
      });

      if (!escrow) {
        throw new Error('Escrow not found');
      }

      if (!escrow.canTransitionTo(EscrowStatus.DISPUTED)) {
        throw new Error('Invalid escrow status for dispute');
      }

      escrow.status = EscrowStatus.DISPUTED;
      escrow.disputeReason = disputeEscrowDto.reason;
      await entityManager.save(escrow);

      this.auditService.logEscrowEvent(
        'DISPUTE',
        escrow.id,
        `Dispute initiated: ${disputeEscrowDto.reason}`
      );

      return escrow;
    });
  }

  /**
   * Admin resolves dispute
   */
  async resolveDispute(escrowId: string, resolution: 'release' | 'refund'): Promise<string> {
    return this.dataSource.transaction(async (entityManager) => {
      const escrow = await entityManager.findOne(Escrow, {
        where: { id: escrowId },
        lock: { mode: 'pessimistic_write' }
      });

      if (!escrow) {
        throw new Error('Escrow not found');
      }

      if (escrow.status !== EscrowStatus.DISPUTED) {
        throw new Error('Escrow is not in disputed state');
      }

      const transaction = await this.transactionRepository.findOne({
        where: { id: escrow.transactionId }
      });

      if (!transaction) {
        throw new Error('Transaction not found');
      }

      let txHash: string;
      if (resolution === 'release') {
        txHash = await this.stellarService.releaseFunds(
          escrow.id,
          (transaction as any).sellerAddress || 'default-seller-address',
          escrow.amount
        );
        escrow.status = EscrowStatus.RELEASED;
        escrow.releasedAt = new Date();
      } else {
        txHash = await this.stellarService.releaseFunds(
          escrow.id,
          (transaction as any).buyerAddress || 'default-buyer-address',
          escrow.amount
        );
        escrow.status = EscrowStatus.REFUNDED;
        escrow.releasedAt = new Date();
      }

      await entityManager.save(escrow);

      this.auditService.logEscrowEvent(
        'DISPUTE_RESOLVED',
        escrow.id,
        `Dispute resolved: ${resolution}. Stellar TX: ${txHash}`
      );

      this.cancelAutoRelease(escrow.id);

      return txHash;
    });
  }

  /**
   * Auto-release job handler
   */
  @Cron('* * * * *') // Runs every minute
  async handleAutoRelease(): Promise<void> {
    const expiringEscrows = await this.escrowRepository.find({
      where: {
        status: EscrowStatus.LOCKED,
        timeoutAt: LessThan(new Date())
      }
    });

    for (const escrow of expiringEscrows) {
      try {
        await this.releaseFunds({
          escrowId: escrow.id,
          buyerSignature: 'AUTO_RELEASE' // Special signature for auto-release
        });
      } catch (error) {
        this.logger.error(`Auto-release failed for escrow ${escrow.id}: ${error.message}`);
      }
    }
  }

  /**
   * Get escrow status
   */
  async getEscrowStatus(escrowId: string): Promise<Escrow> {
    const escrow = await this.escrowRepository.findOne({
      where: { id: escrowId },
      relations: ['transaction']
    });

    if (!escrow) {
      throw new Error('Escrow not found');
    }

    return escrow;
  }

  private scheduleAutoRelease(escrowId: string, timeoutAt: Date): void {
    const job = new CronJob(timeoutAt, async () => {
      await this.handleAutoReleaseForEscrow(escrowId);
    });

    this.schedulerRegistry.addCronJob(`escrow_auto_release_${escrowId}`, job);
    job.start();
  }

  private cancelAutoRelease(escrowId: string): void {
    try {
      this.schedulerRegistry.deleteCronJob(`escrow_auto_release_${escrowId}`);
    } catch (error) {
      this.logger.warn(`Failed to cancel auto-release job for escrow ${escrowId}`);
    }
  }

  private async handleAutoReleaseForEscrow(escrowId: string): Promise<void> {
    try {
      await this.releaseFunds({
        escrowId: escrowId,
        buyerSignature: 'AUTO_RELEASE'
      });
    } catch (error) {
      this.logger.error(`Auto-release failed for escrow ${escrowId}: ${error.message}`);
    }
  }
}
