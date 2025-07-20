import { Injectable, NotFoundException, Logger, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Transaction } from './entities/transaction.entity';
import { EscrowService } from '../escrow/escrow.service';
import { CreateEscrowDto } from '../escrow/dto/create-escrow.dto';
import { EscrowStatus } from '../escrow/interfaces/escrow.interface';

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    private readonly escrowService: EscrowService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Get all transactions for a specific user with escrow status
   */
  async getUserTransactions(userId: number): Promise<Transaction[]> {
    this.logger.log(`Fetching transactions for user ${userId}`);
    
    try {
      const transactions = await this.transactionRepository.find({
        where: [
          { senderId: userId },
          { receiverId: userId }
        ],
        relations: ['sender', 'receiver'],
        order: { createdAt: 'DESC' }
      });

      // Enhance with escrow status
      return Promise.all(transactions.map(async transaction => {
        if (transaction.escrowId) {
          try {
            const escrow = await this.escrowService.getEscrowStatus(transaction.escrowId);
            transaction.escrowStatus = escrow.status;
          } catch (error) {
            this.logger.error(`Error fetching escrow status for transaction ${transaction.id}: ${error.message}`);
          }
        }
        return transaction;
      }));

    } catch (error) {
      this.logger.error(`Error fetching transactions: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get transaction with escrow details
   */
  async getTransactionById(id: string): Promise<Transaction> {
    const transaction = await this.transactionRepository.findOne({
      where: { id },
      relations: ['sender', 'receiver']
    });

    if (!transaction) {
      throw new NotFoundException(`Transaction ${id} not found`);
    }

    if (transaction.escrowId) {
      try {
        const escrow = await this.escrowService.getEscrowStatus(transaction.escrowId);
        transaction.escrowStatus = escrow.status;
      } catch (error) {
        this.logger.error(`Error fetching escrow: ${error.message}`);
      }
    }

    return transaction;
  }

  /**
   * Create transaction with escrow
   */
  async createTransactionWithEscrow(transactionData: Partial<Transaction>): Promise<Transaction> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Create transaction record
      const transaction = await queryRunner.manager.save(
        this.transactionRepository.create(transactionData)
      );

      // Create escrow if required
      if (transactionData.useEscrow) {
        const escrowDto: CreateEscrowDto = {
          transactionId: transaction.id,
          amount: transaction.amount,
          timeoutHours: 72, // Default 72 hours
          buyerAddress: transaction.sender.stellarAddress,
          sellerAddress: transaction.receiver.stellarAddress,
          memo: `Escrow for TX:${transaction.id}`
        };

        const escrow = await this.escrowService.createEscrow(escrowDto);
        transaction.escrowId = escrow.id;
        transaction.escrowStatus = escrow.status;

        await queryRunner.manager.save(transaction);
      }

      await queryRunner.commitTransaction();
      return transaction;

    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Transaction creation failed: ${error.message}`);
      throw new ConflictException('Failed to create transaction with escrow');
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Update transaction based on escrow status changes
   */
  async updateTransactionFromEscrow(escrowId: string): Promise<void> {
    const transaction = await this.transactionRepository.findOne({
      where: { escrowId }
    });

    if (!transaction) {
      this.logger.warn(`No transaction found for escrow ${escrowId}`);
      return;
    }

    try {
      const escrow = await this.escrowService.getEscrowStatus(escrowId);
      
      // Update transaction based on escrow status
      switch (escrow.status) {
        case EscrowStatus.RELEASED:
          transaction.status = 'completed';
          break;
        case EscrowStatus.DISPUTED:
          transaction.status = 'disputed';
          break;
        case EscrowStatus.EXPIRED:
          transaction.status = 'expired';
          break;
      }

      transaction.escrowStatus = escrow.status;
      await this.transactionRepository.save(transaction);

    } catch (error) {
      this.logger.error(`Failed to update transaction from escrow: ${error.message}`);
    }
  }

  /**
   * Handle transaction completion with escrow release
   */
  async completeTransaction(transactionId: string): Promise<void> {
    const transaction = await this.getTransactionById(transactionId);

    if (!transaction.escrowId) {
      throw new ConflictException('Transaction is not using escrow');
    }

    try {
      await this.escrowService.releaseFunds({
        escrowId: transaction.escrowId,
        buyerSignature: `CONFIRM_TX_${transactionId}`
      });
    } catch (error) {
      this.logger.error(`Failed to complete transaction: ${error.message}`);
      throw new ConflictException('Failed to release escrow funds');
    }
  }
}
