import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, Between } from 'typeorm';
import { Transaction, TransactionStatus } from './entities/transaction.entity';
import { ConfigService } from '@nestjs/config';
import { Horizon, Transaction as StellarTransaction } from '@stellar/stellar-sdk';

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    private configService: ConfigService,
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
        where: [{ senderId: userId }, { receiverId: userId }],
        relations: ['sender', 'receiver'],
        order: {
          createdAt: 'DESC',
        },
      });

      this.logger.log(
        `Found ${transactions.length} transactions for user ${userId}`,
      );
      return transactions;
    } catch (error) {
      this.logger.error(
        `Error fetching transactions for user ${userId}: ${error.message}`,
      );
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
      relations: ['sender', 'receiver'],
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
  async createTransaction(
    transactionData: Partial<Transaction>,
  ): Promise<Transaction> {
    const transaction = this.transactionRepository.create(transactionData);
    return this.transactionRepository.save(transaction);
  }

  /**
   * Get all transactions with optional filtering
   * @param options - Filter options
   * @returns Promise<Transaction[]>
   */
  async getAllTransactions(
    options: {
      page?: number;
      limit?: number;
      status?: string;
      type?: string;
      startDate?: Date;
      endDate?: Date;
      search?: string;
    } = {},
  ): Promise<{ transactions: Transaction[]; total: number }> {
    const {
      page = 1,
      limit = 10,
      status,
      type,
      startDate,
      endDate,
      search,
    } = options;

    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (type) {
      where.type = type;
    }

    if (startDate && endDate) {
      where.createdAt = Between(startDate, endDate);
    }

    if (search) {
      where.description = Like(`%${search}%`);
    }

    const [transactions, total] = await this.transactionRepository.findAndCount(
      {
        where,
        relations: ['sender', 'receiver'],
        order: {
          createdAt: 'DESC',
        },
        skip: (page - 1) * limit,
        take: limit,
      },
    );

    return { transactions, total };
  }

  /**
   * Get transaction by Stellar hash
   * @param hash - Stellar transaction hash
   * @returns Promise<Transaction>
   */
  async getTransactionByStellarHash(hash: string): Promise<Transaction> {
    const transaction = await this.transactionRepository.findOne({
      where: { stellarHash: hash },
      relations: ['sender', 'receiver'],
    });

    if (!transaction) {
      throw new NotFoundException(
        `Transaction with Stellar hash ${hash} not found`,
      );
    }

    return transaction;
  }

  /**
   * Get transaction details from Stellar Horizon
   * @param hash - Stellar transaction hash
   * @returns Promise<any>
   */
  async getStellarTransactionDetails(hash: string): Promise<any> {
    try {
      const horizonUrl =
        this.configService.get<string>('STELLAR_HORIZON_URL') ||
        'https://horizon-testnet.stellar.org';
      const server = new Horizon.Server(horizonUrl);

      const transaction = await server.transactions().transaction(hash);
      return transaction;
    } catch (error) {
      this.logger.error(
        `Error fetching Stellar transaction ${hash}: ${error.message}`,
      );
      throw new NotFoundException(
        `Stellar transaction with hash ${hash} not found`,
      );
    }
  }

  /**
   * Verify transaction on Stellar blockchain
   * @param hash - Stellar transaction hash
   * @returns Promise<any>
   */
  async verifyStellarTransaction(hash: string): Promise<{
    stellarTransaction: any;
    localTransaction: Transaction | null;
    isVerified: boolean;
  }> {
    const [stellarTransaction, localTransaction] = await Promise.all([
      this.getStellarTransactionDetails(hash),
      this.getTransactionByStellarHash(hash).catch(() => null),
    ]);

    const isVerified = stellarTransaction && stellarTransaction.successful;

    return {
      stellarTransaction,
      localTransaction,
      isVerified,
    };
  }

  /**
   * Update transaction with Stellar hash
   * @param transactionId - Local transaction ID
   * @param stellarHash - Stellar transaction hash
   * @returns Promise<Transaction>
   */
  async updateTransactionWithStellarHash(
    transactionId: string,
    stellarHash: string,
  ): Promise<Transaction> {
    const transaction = await this.getTransactionById(transactionId);
    transaction.stellarHash = stellarHash;
    transaction.status = TransactionStatus.COMPLETED;

    return this.transactionRepository.save(transaction);
  }

  /**
   * Search transactions by various criteria
   * @param criteria - Search criteria
   * @returns Promise<Transaction[]>
   */
  async searchTransactions(criteria: {
    userId?: number;
    status?: string;
    type?: string;
    minAmount?: number;
    maxAmount?: number;
    startDate?: Date;
    endDate?: Date;
    description?: string;
  }): Promise<Transaction[]> {
    const where: any = {};

    if (criteria.userId) {
      where.senderId = criteria.userId;
    }

    if (criteria.status) {
      where.status = criteria.status;
    }

    if (criteria.type) {
      where.type = criteria.type;
    }

    if (criteria.minAmount && criteria.maxAmount) {
      where.amount = Between(criteria.minAmount, criteria.maxAmount);
    } else if (criteria.minAmount) {
      where.amount = { $gte: criteria.minAmount };
    } else if (criteria.maxAmount) {
      where.amount = { $lte: criteria.maxAmount };
    }

    if (criteria.startDate && criteria.endDate) {
      where.createdAt = Between(criteria.startDate, criteria.endDate);
    }

    if (criteria.description) {
      where.description = Like(`%${criteria.description}%`);
    }

    return this.transactionRepository.find({
      where,
      relations: ['sender', 'receiver'],
      order: {
        createdAt: 'DESC',
      },
    });
  }
}
