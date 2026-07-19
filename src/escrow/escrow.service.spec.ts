/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import * as StellarSdk from '@stellar/stellar-sdk';
import axios from 'axios';

import { EscrowService } from './escrow.service';
import { Escrow, EscrowStatus } from '../entities/escrow.entity';
import { LoggerService } from '../common/logger/logger.service';
import { EncryptionService } from '../common/services/encryption.service';
import { CreateEscrowDto } from './dto/create-escrow.dto';

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock the Horizon.Server used internally by EscrowService
const mockLoadAccount = jest.fn();
const mockSubmitTransaction = jest.fn();

jest.mock('@stellar/stellar-sdk', () => {
  const actual = jest.requireActual('@stellar/stellar-sdk');
  return {
    ...actual,
    Horizon: {
      Server: jest.fn().mockImplementation(() => ({
        loadAccount: mockLoadAccount,
        submitTransaction: mockSubmitTransaction,
      })),
    },
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MOCK_ESCROW_KEYPAIR = StellarSdk.Keypair.random();
const MOCK_SELLER_KEYPAIR = StellarSdk.Keypair.random();

function buildMockEscrow(overrides: Partial<Escrow> = {}): Escrow {
  return {
    id: 'escrow-uuid-1234',
    buyerId: 'buyer-uuid-5678',
    sellerId: 'seller-uuid-9012',
    amount: 50,
    status: EscrowStatus.FUNDED,
    escrowPublicKey: MOCK_ESCROW_KEYPAIR.publicKey(),
    escrowSecretKey: MOCK_ESCROW_KEYPAIR.secret(),
    transactionHash: 'mock-fund-tx-hash',
    released: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('EscrowService', () => {
  let service: EscrowService;
  let escrowRepo: jest.Mocked<Repository<Escrow>>;

  const mockLogger: Partial<LoggerService> = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: string) => {
      const config: Record<string, string> = {
        STELLAR_HORIZON_URL: 'https://horizon-testnet.stellar.org',
        STELLAR_FRIENDBOT_URL: 'https://friendbot.stellar.org',
        ENCRYPTION_SECRET: 'test-encryption-secret-32-chars!!',
      };
      return config[key] ?? defaultValue;
    }),
  };

  const mockManager = {
    query: jest
      .fn()
      .mockResolvedValue([
        { stellarWalletAddress: MOCK_SELLER_KEYPAIR.publicKey() },
      ]),
  };

  let encryptionService: EncryptionService;
  // The encrypted-at-rest form of MOCK_ESCROW_KEYPAIR's secret, computed
  // fresh each test via the real EncryptionService (round-trips through
  // actual AES-256-GCM encrypt/decrypt, not a stub).
  let mockEncryptedSecretKey: string;

  beforeEach(async () => {
    jest.clearAllMocks();

    const repoMock = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
      manager: mockManager,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EscrowService,
        EncryptionService,
        { provide: getRepositoryToken(Escrow), useValue: repoMock },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: LoggerService, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<EscrowService>(EscrowService);
    escrowRepo = module.get(getRepositoryToken(Escrow));
    encryptionService = module.get<EncryptionService>(EncryptionService);

    mockEncryptedSecretKey = encryptionService.encryptString(
      MOCK_ESCROW_KEYPAIR.secret(),
    );

    // Default: signing lookups resolve to a valid encrypted secret. Individual
    // tests override this via escrowRepo.createQueryBuilder.mockReturnValue(...)
    // when they need to simulate a missing/corrupt key.
    (escrowRepo.createQueryBuilder as jest.Mock).mockReturnValue({
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest
        .fn()
        .mockResolvedValue({ escrowSecretKey: mockEncryptedSecretKey }),
    });
  });

  // -------------------------------------------------------------------------
  // createEscrow
  // -------------------------------------------------------------------------

  describe('createEscrow', () => {
    const dto: CreateEscrowDto = {
      amount: 100,
      buyerId: 'buyer-uuid',
      sellerId: 'seller-uuid',
    };

    it('should create a PENDING escrow, fund via Friendbot, and return FUNDED escrow', async () => {
      const pendingEscrow = buildMockEscrow({
        status: EscrowStatus.PENDING,
        transactionHash: null,
      });

      escrowRepo.create.mockReturnValue(pendingEscrow);
      escrowRepo.save.mockResolvedValue(pendingEscrow);

      mockedAxios.get.mockResolvedValue({
        data: { hash: 'friendbot-tx-hash-abc123' },
      });

      const result = await service.createEscrow(dto);

      // Should have called Friendbot
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://friendbot.stellar.org',
        expect.objectContaining({ params: { addr: expect.any(String) } }),
      );

      // Should have saved twice (initial + after funding)
      expect(escrowRepo.save).toHaveBeenCalledTimes(2);

      // Final status should be FUNDED
      expect(result.status).toBe(EscrowStatus.FUNDED);
      expect(result.transactionHash).toBe('friendbot-tx-hash-abc123');
    });

    it('encrypts the escrow secret key before persisting it, never storing it in plaintext', async () => {
      const pendingEscrow = buildMockEscrow({
        status: EscrowStatus.PENDING,
        transactionHash: null,
      });

      escrowRepo.create.mockReturnValue(pendingEscrow);
      escrowRepo.save.mockResolvedValue(pendingEscrow);
      mockedAxios.get.mockResolvedValue({
        data: { hash: 'friendbot-tx-hash-abc123' },
      });

      await service.createEscrow(dto);

      const createArg = escrowRepo.create.mock.calls[0][0] as Escrow;
      expect(createArg.escrowSecretKey).toBeDefined();
      // Must not be (or contain) a raw Stellar secret seed.
      expect(createArg.escrowSecretKey).not.toMatch(/^S[A-Z2-7]{55}$/);

      // But it must decrypt back to a valid secret matching the stored public key.
      const decrypted = encryptionService.decryptString(
        createArg.escrowSecretKey as string,
      );
      expect(decrypted).toMatch(/^S[A-Z2-7]{55}$/);
      expect(StellarSdk.Keypair.fromSecret(decrypted).publicKey()).toBe(
        createArg.escrowPublicKey,
      );
    });

    it('should mark the escrow as FAILED and throw if Friendbot fails', async () => {
      const pendingEscrow = buildMockEscrow({
        status: EscrowStatus.PENDING,
        transactionHash: null,
      });

      escrowRepo.create.mockReturnValue(pendingEscrow);
      escrowRepo.save.mockResolvedValue(pendingEscrow);

      mockedAxios.get.mockRejectedValue(new Error('Friendbot network error'));

      await expect(service.createEscrow(dto)).rejects.toThrow(
        'Stellar escrow funding failed',
      );

      // Should save twice: once before network call (PENDING) and once after failure (FAILED)
      expect(escrowRepo.save).toHaveBeenCalledTimes(2);
      const lastSaveCall = escrowRepo.save.mock.calls[1][0] as Escrow;
      expect(lastSaveCall.status).toBe(EscrowStatus.FAILED);
    });

    it('should mark escrow FAILED if Friendbot returns no hash', async () => {
      const pendingEscrow = buildMockEscrow({ status: EscrowStatus.PENDING });
      escrowRepo.create.mockReturnValue(pendingEscrow);
      escrowRepo.save.mockResolvedValue(pendingEscrow);

      mockedAxios.get.mockResolvedValue({ data: {} }); // no hash field

      await expect(service.createEscrow(dto)).rejects.toThrow(
        'Stellar escrow funding failed',
      );
    });
  });

  // -------------------------------------------------------------------------
  // releaseEscrow
  // -------------------------------------------------------------------------

  describe('releaseEscrow', () => {
    it('should submit a Stellar payment and return a RELEASED escrow', async () => {
      const fundedEscrow = buildMockEscrow();
      escrowRepo.findOne.mockResolvedValue(fundedEscrow);
      escrowRepo.save.mockResolvedValue({
        ...fundedEscrow,
        status: EscrowStatus.RELEASED,
        transactionHash: 'release-tx-hash-xyz',
        released: true,
      });

      // loadAccount returns a mock StellarSdk account-like object
      mockLoadAccount.mockResolvedValue(
        new StellarSdk.Account(MOCK_ESCROW_KEYPAIR.publicKey(), '100'),
      );

      mockSubmitTransaction.mockResolvedValue({ hash: 'release-tx-hash-xyz' });

      // Manager query returns seller's Stellar address
      mockManager.query.mockResolvedValue([
        { stellarWalletAddress: MOCK_SELLER_KEYPAIR.publicKey() },
      ]);

      const result = await service.releaseEscrow('escrow-uuid-1234');

      expect(mockSubmitTransaction).toHaveBeenCalledTimes(1);
      expect(result.status).toBe(EscrowStatus.RELEASED);
      expect(result.transactionHash).toBe('release-tx-hash-xyz');
      expect(result.released).toBe(true);
    });

    it('decrypts the stored secret and signs the release transaction with the escrow keypair', async () => {
      const fundedEscrow = buildMockEscrow();
      escrowRepo.findOne.mockResolvedValue(fundedEscrow);
      escrowRepo.save.mockResolvedValue({
        ...fundedEscrow,
        status: EscrowStatus.RELEASED,
      });

      mockLoadAccount.mockResolvedValue(
        new StellarSdk.Account(MOCK_ESCROW_KEYPAIR.publicKey(), '100'),
      );
      mockSubmitTransaction.mockResolvedValue({ hash: 'release-tx-hash-xyz' });
      mockManager.query.mockResolvedValue([
        { stellarWalletAddress: MOCK_SELLER_KEYPAIR.publicKey() },
      ]);

      await service.releaseEscrow('escrow-uuid-1234');

      const submittedTx = mockSubmitTransaction.mock
        .calls[0][0] as StellarSdk.Transaction;

      expect(submittedTx.signatures.length).toBe(1);
      const signature = submittedTx.signatures[0].signature();
      // The transaction can only verify against the escrow account's public
      // key if it was actually signed with the correctly decrypted secret.
      expect(MOCK_ESCROW_KEYPAIR.verify(submittedTx.hash(), signature)).toBe(
        true,
      );
    });

    it('logs access when the escrow secret key is decrypted for signing, without leaking the secret', async () => {
      const fundedEscrow = buildMockEscrow();
      escrowRepo.findOne.mockResolvedValue(fundedEscrow);
      escrowRepo.save.mockResolvedValue({
        ...fundedEscrow,
        status: EscrowStatus.RELEASED,
      });

      mockLoadAccount.mockResolvedValue(
        new StellarSdk.Account(MOCK_ESCROW_KEYPAIR.publicKey(), '100'),
      );
      mockSubmitTransaction.mockResolvedValue({ hash: 'release-tx-hash-xyz' });
      mockManager.query.mockResolvedValue([
        { stellarWalletAddress: MOCK_SELLER_KEYPAIR.publicKey() },
      ]);

      await service.releaseEscrow('escrow-uuid-1234');

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('decrypted for transaction signing'),
        expect.objectContaining({ escrowId: 'escrow-uuid-1234' }),
      );

      const loggedSecret = (mockLogger.info as jest.Mock).mock.calls.some(
        (call: unknown[]) =>
          call.some(
            (arg) =>
              typeof arg === 'string' &&
              arg.includes(MOCK_ESCROW_KEYPAIR.secret()),
          ),
      );
      expect(loggedSecret).toBe(false);
    });

    it('should throw InternalServerErrorException when the encrypted secret key is missing', async () => {
      const fundedEscrow = buildMockEscrow();
      escrowRepo.findOne.mockResolvedValue(fundedEscrow);
      (escrowRepo.createQueryBuilder as jest.Mock).mockReturnValue({
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ escrowSecretKey: null }),
      });

      await expect(service.releaseEscrow('escrow-uuid-1234')).rejects.toThrow(
        'missing keypair data',
      );
    });

    it('should throw BadRequestException when escrow is not FUNDED', async () => {
      const releasedEscrow = buildMockEscrow({ status: EscrowStatus.RELEASED });
      escrowRepo.findOne.mockResolvedValue(releasedEscrow);

      await expect(service.releaseEscrow('escrow-uuid-1234')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw InternalServerErrorException when escrow has no keypair', async () => {
      const brokenEscrow = buildMockEscrow({
        escrowSecretKey: null,
        escrowPublicKey: null,
      });
      escrowRepo.findOne.mockResolvedValue(brokenEscrow);

      await expect(service.releaseEscrow('escrow-uuid-1234')).rejects.toThrow(
        'missing keypair data',
      );
    });

    it('should throw InternalServerErrorException on Stellar submission error', async () => {
      const fundedEscrow = buildMockEscrow();
      escrowRepo.findOne.mockResolvedValue(fundedEscrow);

      mockLoadAccount.mockResolvedValue(
        new StellarSdk.Account(MOCK_ESCROW_KEYPAIR.publicKey(), '100'),
      );
      mockManager.query.mockResolvedValue([
        { stellarWalletAddress: MOCK_SELLER_KEYPAIR.publicKey() },
      ]);
      mockSubmitTransaction.mockRejectedValue(new Error('Horizon error'));

      await expect(service.releaseEscrow('escrow-uuid-1234')).rejects.toThrow(
        'Stellar escrow release failed',
      );
    });
  });

  // -------------------------------------------------------------------------
  // findOne
  // -------------------------------------------------------------------------

  describe('findOne', () => {
    it('should return the escrow when found', async () => {
      const escrow = buildMockEscrow();
      escrowRepo.findOne.mockResolvedValue(escrow);

      const result = await service.findOne('escrow-uuid-1234');

      expect(result).toEqual(escrow);
      expect(escrowRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'escrow-uuid-1234' },
      });
    });

    it('should throw NotFoundException when not found', async () => {
      escrowRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
