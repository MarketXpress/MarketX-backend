import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { WalletService } from './wallet.service';
import { Wallet } from './entities/wallet.entity';
import { WalletKeyAudit } from './entities/wallet-key-audit.entity';
import { EventNames } from '../common/events';

// Prevent real Stellar network calls
jest.mock('@stellar/stellar-sdk', () => ({
  Horizon: {
    Server: jest.fn().mockImplementation(() => ({
      loadAccount: jest.fn().mockResolvedValue({
        balances: [{ asset_type: 'native', balance: '500.0000000' }],
      }),
    })),
  },
  Networks: { TESTNET: 'Test SDF Network ; September 2015' },
}));

const VALID_STELLAR_ADDRESS =
  'GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37';
const MOCK_SECRET_KEY = '12345678901234567890123456789012'; // 32 chars for AES-256

describe('WalletService', () => {
  let service: WalletService;
  let mockWalletRepo: any;
  let mockAuditRepo: any;
  let mockEventEmitter: any;

  const testUserId = 'user-abc';

  const makeMockWallet = (overrides = {}): Partial<Wallet> => ({
    id: 'wallet-1',
    userId: testUserId,
    publicKey: 'GPUBKEY123',
    secretKey: 'encrypted-secret',
    ...overrides,
  });

  beforeEach(async () => {
    mockWalletRepo = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
    };

    mockAuditRepo = {
      save: jest.fn(),
    };

    mockEventEmitter = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletService,
        { provide: getRepositoryToken(Wallet), useValue: mockWalletRepo },
        {
          provide: getRepositoryToken(WalletKeyAudit),
          useValue: mockAuditRepo,
        },
        { provide: EventEmitter2, useValue: mockEventEmitter },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(MOCK_SECRET_KEY),
          },
        },
      ],
    }).compile();

    service = module.get<WalletService>(WalletService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────
  // generateKeyPair
  // ─────────────────────────────────────────────────────────────

  describe('generateKeyPair', () => {
    it('should generate non-empty, distinct publicKey and secretKey', () => {
      const { publicKey, secretKey } = service.generateKeyPair();

      expect(publicKey).toBeDefined();
      expect(secretKey).toBeDefined();
      expect(publicKey.length).toBeGreaterThan(0);
      expect(secretKey.length).toBeGreaterThan(0);
      expect(publicKey).not.toBe(secretKey);
    });

    it('should generate unique key pairs on each call', () => {
      const pair1 = service.generateKeyPair();
      const pair2 = service.generateKeyPair();

      expect(pair1.publicKey).not.toBe(pair2.publicKey);
      expect(pair1.secretKey).not.toBe(pair2.secretKey);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // requestWithdrawal — critical amount / balance mutations
  // ─────────────────────────────────────────────────────────────

  describe('requestWithdrawal', () => {
    // ── MUTATION TARGET: amount <= 0 ─────────────────────────────────────
    it('should throw BadRequestException when amount is 0', async () => {
      await expect(
        service.requestWithdrawal(testUserId, 0, VALID_STELLAR_ADDRESS, '127.0.0.1'),
      ).rejects.toThrow('Withdrawal amount must be positive');
    });

    it('should throw BadRequestException when amount is negative', async () => {
      await expect(
        service.requestWithdrawal(
          testUserId,
          -10,
          VALID_STELLAR_ADDRESS,
          '127.0.0.1',
        ),
      ).rejects.toThrow('Withdrawal amount must be positive');
    });

    it('should NOT throw for a positive amount (inverse guard)', async () => {
      const wallet = makeMockWallet();
      mockWalletRepo.findOne.mockResolvedValue(wallet);
      jest.spyOn(service, 'getWalletBalance').mockResolvedValue({
        balance: '1000.0',
        currency: 'XLM',
        publicKey: wallet.publicKey!,
      });

      await expect(
        service.requestWithdrawal(
          testUserId,
          100,
          VALID_STELLAR_ADDRESS,
          '127.0.0.1',
        ),
      ).resolves.not.toThrow();
    });

    it('should throw BadRequestException when wallet is not found', async () => {
      mockWalletRepo.findOne.mockResolvedValue(null);

      await expect(
        service.requestWithdrawal(
          testUserId,
          10,
          VALID_STELLAR_ADDRESS,
          '127.0.0.1',
        ),
      ).rejects.toThrow('Wallet not found for user');
    });

    it('should throw BadRequestException for an invalid Stellar address', async () => {
      mockWalletRepo.findOne.mockResolvedValue(makeMockWallet());

      await expect(
        service.requestWithdrawal(
          testUserId,
          10,
          'NOT_A_VALID_ADDRESS',
          '127.0.0.1',
        ),
      ).rejects.toThrow('Invalid destination address');
    });

    // ── MUTATION TARGET: parseFloat(balance) < amount ────────────────────
    it('should throw BadRequestException and emit FAILURE event when balance is insufficient', async () => {
      const wallet = makeMockWallet();
      mockWalletRepo.findOne.mockResolvedValue(wallet);
      jest.spyOn(service, 'getWalletBalance').mockResolvedValue({
        balance: '5.0', // much less than requested 100
        currency: 'XLM',
        publicKey: wallet.publicKey!,
      });

      await expect(
        service.requestWithdrawal(
          testUserId,
          100,
          VALID_STELLAR_ADDRESS,
          '127.0.0.1',
        ),
      ).rejects.toThrow('Insufficient balance for withdrawal');

      // Confirm FAILURE audit event was emitted
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        EventNames.WALLET_WITHDRAWAL_REQUESTED,
        expect.objectContaining({ status: 'FAILURE' }),
      );
    });

    it('should succeed and emit SUCCESS event when balance is exactly equal to amount', async () => {
      const wallet = makeMockWallet();
      mockWalletRepo.findOne.mockResolvedValue(wallet);
      jest.spyOn(service, 'getWalletBalance').mockResolvedValue({
        balance: '100.0', // equals requested amount — must NOT throw
        currency: 'XLM',
        publicKey: wallet.publicKey!,
      });

      const result = await service.requestWithdrawal(
        testUserId,
        100,
        VALID_STELLAR_ADDRESS,
        '127.0.0.1',
      );

      expect(result.success).toBe(true);
      expect(result.transactionId).toBeDefined();
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        EventNames.WALLET_WITHDRAWAL_REQUESTED,
        expect.objectContaining({ status: 'SUCCESS' }),
      );
    });

    it('should succeed when balance is greater than amount', async () => {
      const wallet = makeMockWallet();
      mockWalletRepo.findOne.mockResolvedValue(wallet);
      jest.spyOn(service, 'getWalletBalance').mockResolvedValue({
        balance: '9999.0',
        currency: 'XLM',
        publicKey: wallet.publicKey!,
      });

      const result = await service.requestWithdrawal(
        testUserId,
        50,
        VALID_STELLAR_ADDRESS,
        '127.0.0.1',
      );

      expect(result.success).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // requestDeposit
  // ─────────────────────────────────────────────────────────────

  describe('requestDeposit', () => {
    it('should throw BadRequestException when deposit amount is 0', async () => {
      await expect(
        service.requestDeposit(testUserId, 0, '127.0.0.1'),
      ).rejects.toThrow('Deposit amount must be positive');
    });

    it('should throw BadRequestException when deposit amount is negative', async () => {
      await expect(
        service.requestDeposit(testUserId, -1, '127.0.0.1'),
      ).rejects.toThrow('Deposit amount must be positive');
    });

    it('should throw BadRequestException when wallet is not found', async () => {
      mockWalletRepo.findOne.mockResolvedValue(null);

      await expect(
        service.requestDeposit(testUserId, 50, '127.0.0.1'),
      ).rejects.toThrow('Wallet not found for user');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // regenerateWalletKeys
  // ─────────────────────────────────────────────────────────────

  describe('regenerateWalletKeys', () => {
    it('should log previous keys to audit table and replace them', async () => {
      const wallet = makeMockWallet() as Wallet;
      mockWalletRepo.findOne.mockResolvedValue(wallet);
      mockWalletRepo.save.mockResolvedValue(wallet);
      mockAuditRepo.save.mockResolvedValue({});

      const result = await service.regenerateWalletKeys(testUserId);

      // Audit must be recorded with the OLD keys
      expect(mockAuditRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          oldPublicKey: 'GPUBKEY123',
        }),
      );

      // Wallet must have new keys
      expect(result.publicKey).not.toBe('GPUBKEY123');
    });

    it('should throw an error when wallet is not found', async () => {
      mockWalletRepo.findOne.mockResolvedValue(null);

      await expect(service.regenerateWalletKeys(testUserId)).rejects.toThrow(
        'Wallet not found for user',
      );
    });
  });
});
