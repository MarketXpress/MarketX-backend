import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

import { TransactionsService } from './transactions.service';
import { Transaction, TransactionStatus } from './entities/transaction.entity';

// Prevent real Stellar network calls
jest.mock('@stellar/stellar-sdk', () => ({
  Horizon: {
    Server: jest.fn().mockImplementation(() => ({
      transactions: jest.fn().mockReturnValue({
        transaction: jest.fn().mockResolvedValue({ successful: true, hash: 'mock-hash' }),
      }),
    })),
  },
}));

describe('TransactionsService', () => {
  let service: TransactionsService;
  let mockTransactionRepo: any;

  const testTransactionId = 'tx-uuid-1';
  const testStellarHash = 'abc123def456';

  const makeTransaction = (
    overrides: Partial<Transaction> = {},
  ): Partial<Transaction> => ({
    id: testTransactionId,
    stellarHash: testStellarHash,
    status: TransactionStatus.PENDING,
    senderId: 1,
    receiverId: 2,
    amount: 100,
    ...overrides,
  });

  beforeEach(async () => {
    mockTransactionRepo = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      findAndCount: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        {
          provide: getRepositoryToken(Transaction),
          useValue: mockTransactionRepo,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('https://horizon-testnet.stellar.org'),
          },
        },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────
  // getTransactionById
  // ─────────────────────────────────────────────────────────────

  describe('getTransactionById', () => {
    it('should return the transaction when found', async () => {
      const tx = makeTransaction();
      mockTransactionRepo.findOne.mockResolvedValue(tx);

      const result = await service.getTransactionById(testTransactionId);

      expect(result).toEqual(tx);
      expect(mockTransactionRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: testTransactionId } }),
      );
    });

    it('should throw NotFoundException when transaction is not found', async () => {
      mockTransactionRepo.findOne.mockResolvedValue(null);

      await expect(
        service.getTransactionById('non-existent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // createTransaction
  // ─────────────────────────────────────────────────────────────

  describe('createTransaction', () => {
    it('should create and return a new transaction', async () => {
      const data = { senderId: 1, receiverId: 2, amount: 50 };
      const saved = makeTransaction(data);
      mockTransactionRepo.create.mockReturnValue(saved);
      mockTransactionRepo.save.mockResolvedValue(saved);

      const result = await service.createTransaction(data);

      expect(result).toEqual(saved);
      expect(mockTransactionRepo.create).toHaveBeenCalledWith(data);
      expect(mockTransactionRepo.save).toHaveBeenCalledWith(saved);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // getUserTransactions
  // ─────────────────────────────────────────────────────────────

  describe('getUserTransactions', () => {
    it('should return all transactions for a given user', async () => {
      const transactions = [makeTransaction(), makeTransaction({ id: 'tx-2' })];
      mockTransactionRepo.find.mockResolvedValue(transactions);

      const result = await service.getUserTransactions(1);

      expect(result).toEqual(transactions);
      expect(mockTransactionRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.arrayContaining([
            { senderId: 1 },
            { receiverId: 1 },
          ]),
        }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // getAllTransactions
  // ─────────────────────────────────────────────────────────────

  describe('getAllTransactions', () => {
    it('should return transactions and total count', async () => {
      const transactions = [makeTransaction()];
      mockTransactionRepo.findAndCount.mockResolvedValue([transactions, 1]);

      const result = await service.getAllTransactions({ page: 1, limit: 10 });

      expect(result.transactions).toEqual(transactions);
      expect(result.total).toBe(1);
    });

    it('should apply status filter when provided', async () => {
      mockTransactionRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.getAllTransactions({ status: 'completed' });

      const callArg = mockTransactionRepo.findAndCount.mock.calls[0][0];
      expect(callArg.where).toHaveProperty('status', 'completed');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // updateTransactionWithStellarHash — COMPLETED status mutation
  // ─────────────────────────────────────────────────────────────

  describe('updateTransactionWithStellarHash', () => {
    it('should set status to COMPLETED and attach stellarHash', async () => {
      const tx = makeTransaction({
        status: TransactionStatus.PENDING,
        stellarHash: undefined,
      }) as Transaction;
      mockTransactionRepo.findOne.mockResolvedValue(tx);
      mockTransactionRepo.save.mockResolvedValue({
        ...tx,
        stellarHash: testStellarHash,
        status: TransactionStatus.COMPLETED,
      });

      const result = await service.updateTransactionWithStellarHash(
        testTransactionId,
        testStellarHash,
      );

      expect(result.status).toBe(TransactionStatus.COMPLETED);
      expect(result.stellarHash).toBe(testStellarHash);
    });

    it('should throw NotFoundException when transaction does not exist', async () => {
      mockTransactionRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateTransactionWithStellarHash('non-existent', testStellarHash),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // getTransactionByStellarHash
  // ─────────────────────────────────────────────────────────────

  describe('getTransactionByStellarHash', () => {
    it('should return the transaction matching the Stellar hash', async () => {
      const tx = makeTransaction();
      mockTransactionRepo.findOne.mockResolvedValue(tx);

      const result = await service.getTransactionByStellarHash(testStellarHash);

      expect(result.stellarHash).toBe(testStellarHash);
    });

    it('should throw NotFoundException when no transaction matches the hash', async () => {
      mockTransactionRepo.findOne.mockResolvedValue(null);

      await expect(
        service.getTransactionByStellarHash('non-existent-hash'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
