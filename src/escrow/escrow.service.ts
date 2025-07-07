import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Escrow } from './escrow.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { CreateEscrowDto } from './dto/create-escrow.dto';
import { ReleaseEscrowDto } from './dto/update-escrow.dto';
import { ConfigService } from '@nestjs/config';
import { StellarService } from '../stellar/stellar.service';
import { EscrowStatus } from './escrow.enum';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { AuditService } from '../audit/audit.service';
import { DisputeEscrowDto } from './dto/dispute-escrow.dto';
import { PartialReleaseDto } from './dto/partial-release.dto';

@Injectable()
export class EscrowService {
  private readonly logger = new Logger(EscrowService.name);
  private readonly autoReleaseTimeout: number;

  constructor(
    @InjectRepository(Escrow)
    private readonly escrowRepository: Repository<Escrow>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly stellarService: StellarService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly auditService: AuditService,
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
        timeoutAt: new Date(Date.now() + this.autoReleaseTimeout * 1000)
      });

      await entityManager.save(escrow);

      try {
        // Lock funds on Stellar
        const lockTxHash = await this.stellarService.lockFunds(
          transaction.buyerAddress,
          transaction.sellerAddress,
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

      // Validate buyer signature
      if (releaseEscrowDto.buyerSignature !== transaction.buyerSignature) {
        throw new Error('Invalid buyer confirmation');
      }

      try {
        const releaseTxHash = await this.stellarService.releaseFunds(
          escrow.id,
          transaction.sellerAddress,
          escrow.amount
        );

        escrow.status = EscrowStatus.RELEASED;
        escrow.releasedAt = new Date();
        escrow.releasedTo = transaction.sellerAddress;
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
    // Implementation similar to releaseFunds but with partial amount
    // Includes additional validation for partial amount
  }

  /**
   * Initiates dispute resolution
   */
  async initiateDispute(disputeEscrowDto: DisputeEscrowDto): Promise<Escrow> {
    // Validates dispute initiation
    // Updates escrow status to DISPUTED
    // Notifies admin
  }

  /**
   * Admin resolves dispute
   */
  async resolveDispute(escrowId: string, resolution: 'release'|'refund'): Promise<string> {
    // Admin-only operation
    // Handles fund release or return based on resolution
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
    // Dedicated auto-release handler for individual escrows
  }
}
