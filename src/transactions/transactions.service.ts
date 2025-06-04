import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from './entities/transaction.entity';

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
  ) {}

  /**
   * Get all transactions for a specific user (both as sender and receiver)
   * @param userId - The ID of the user
   * @returns Promise<Transaction[]> - Array of transactions sorted by date descending
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
        order: {
          createdAt: 'DESC'
        }
      });

      this.logger.log(`Found ${transactions.length} transactions for user ${userId}`);
      return transactions;
    } catch (error) {
      this.logger.error(`Error fetching transactions for user ${userId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get a specific transaction by ID
   * @param id - Transaction ID
   * @returns Promise<Transaction>
   */
  async getTransactionById(id: string): Promise<Transaction> {
    const transaction = await this.transactionRepository.findOne({
      where: { id },
      relations: ['sender', 'receiver']
    });

    if (!transaction) {
      throw new NotFoundException(`Transaction with ID ${id} not found`);
    }

    return transaction;
  }

  /**
   * Create a new transaction
   * @param transactionData - Transaction data
   * @returns Promise<Transaction>
   */
  async createTransaction(transactionData: Partial<Transaction>): Promise<Transaction> {
    const transaction = this.transactionRepository.create(transactionData);
    return this.transactionRepository.save(transaction);
  }
} 