import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { EscrowService } from './escrow.service';
import { EscrowEntity, EscrowStatus } from './entities/escrow.entity';
import {
  CreateEscrowDto,
  ReleaseEscrowDto,
  RefundEscrowDto,
} from './dto/escrow-transaction.dto';

jest.mock('@stellar/stellar-sdk', () => ({
  Keypair: {
    random: () => ({
      publicKey: () => 'GESCROWPUBKEY',
      secret: () => 'SESCROWSECKEY',
    }),
  },
  Horizon: {
    Server: jest.fn().mockImplementation(() => ({
      loadAccount: jest.fn().mockResolvedValue({
        accountId: () => 'GTESTACCOUNT',
        sequenceNumber: () => '123456',
      }),
      submitTransaction: jest.fn().mockResolvedValue({ hash: 'tx-hash-mock' }),
    })),
  },
  Networks: { TESTNET: 'Test SDF Network ; September 2015' },
  BASE_FEE: '100',
  TransactionBuilder: jest.fn().mockImplementation(() => ({
    addOperation: jest.fn().mockReturnThis(),
    setTimeout: jest.fn().mockReturnThis(),
    build: jest.fn().mockReturnValue('built-tx'),
  })),
  Operation: {
    payment: jest.fn().mockReturnValue({}),
  },
  Asset: { native: jest.fn() },
}));

describe('EscrowService', () => {
  let service: EscrowService;
  let mockEscrowRepo: any;

  const testEscrowId = 'escrow-1';
  const testOrderId = 'order-1';

  const makeEscrow = (
    overrides: Partial<EscrowEntity> = {},
  ): Partial<EscrowEntity> => ({
    id: testEscrowId,
    orderId: testOrderId,
    buyerPublicKey: 'GBUYERPUBKEY',
    sellerPublicKey: 'GSELLERPUBKEY',
    amount: 100,
    releasedAmount: 0,
    refundedAmount: 0,
    escrowAccountPublicKey: 'GESCROWPUBKEY',
    lockTransactionHash: null,
    releaseTransactionHash: null,
    refundTransactionHash: null,
    status: EscrowStatus.PENDING,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeEach(async () => {
    mockEscrowRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EscrowService,
        {
          provide: getRepositoryToken(EscrowEntity),
          useValue: mockEscrowRepo,
        },
      ],
    }).compile();

    service = module.get<EscrowService>(EscrowService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createEscrow', () => {
    const validDto: CreateEscrowDto = {
      orderId: testOrderId,
      buyerPublicKey: 'GBUYERPUBKEY',
      sellerPublicKey: 'GSELLERPUBKEY',
      amount: 100,
    };

    it('should create escrow with valid data', async () => {
      const escrow = makeEscrow({ status: EscrowStatus.LOCKED });
      mockEscrowRepo.create.mockReturnValue(escrow);
      mockEscrowRepo.save.mockImplementation(async (e: any) => ({
        ...e,
        lockTransactionHash: 'tx-hash-mock',
        status: EscrowStatus.LOCKED,
      }));

      const result = await service.createEscrow(validDto);

      expect(mockEscrowRepo.create).toHaveBeenCalled();
      expect(mockEscrowRepo.save).toHaveBeenCalled();
      expect(result.status).toBe(EscrowStatus.LOCKED);
    });

    it('should throw BadRequestException if amount is zero', async () => {
      await expect(
        service.createEscrow({ ...validDto, amount: 0 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if amount is negative', async () => {
      await expect(
        service.createEscrow({ ...validDto, amount: -10 }),
      ).rejects.toThrow('Amount must be positive');
    });

    it('should throw BadRequestException if buyer and seller are the same', async () => {
      await expect(
        service.createEscrow({
          ...validDto,
          buyerPublicKey: 'SAMEKEY',
          sellerPublicKey: 'SAMEKEY',
        }),
      ).rejects.toThrow('Buyer and seller cannot be the same');
    });
  });

  describe('releaseFunds', () => {
    it('should release funds from a LOCKED escrow', async () => {
      const escrow = makeEscrow({ status: EscrowStatus.LOCKED });
      mockEscrowRepo.findOne.mockResolvedValue(escrow);
      mockEscrowRepo.save.mockImplementation(async (e: any) => e);

      const result = await service.releaseFunds({
        escrowId: testEscrowId,
        deliveryProof: 'proof',
      });

      expect(result.status).toBe(EscrowStatus.RELEASED);
      expect(result.releaseTransactionHash).toBe('tx-hash-mock');
    });

    it('should throw NotFoundException if escrow not found', async () => {
      mockEscrowRepo.findOne.mockResolvedValue(null);

      await expect(
        service.releaseFunds({ escrowId: 'nonexistent', deliveryProof: 'proof' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for invalid status transition', async () => {
      const escrow = makeEscrow({ status: EscrowStatus.RELEASED });
      mockEscrowRepo.findOne.mockResolvedValue(escrow);

      await expect(
        service.releaseFunds({ escrowId: testEscrowId, deliveryProof: 'proof' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when releasing from PENDING status', async () => {
      const escrow = makeEscrow({ status: EscrowStatus.PENDING });
      mockEscrowRepo.findOne.mockResolvedValue(escrow);

      await expect(
        service.releaseFunds({ escrowId: testEscrowId, deliveryProof: 'proof' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('releasePartial', () => {
    it('should partially release funds from a LOCKED escrow', async () => {
      const escrow = makeEscrow({ status: EscrowStatus.LOCKED, amount: 100 });
      mockEscrowRepo.findOne.mockResolvedValue(escrow);
      mockEscrowRepo.save.mockImplementation(async (e: any) => e);

      const result = await service.releasePartial(testEscrowId, 60);

      expect(result.status).toBe(EscrowStatus.PARTIALLY_RELEASED);
      expect(result.releasedAmount).toBe(60);
      expect(result.refundedAmount).toBe(40);
    });

    it('should fully release when releasedAmount equals total', async () => {
      const escrow = makeEscrow({ status: EscrowStatus.LOCKED, amount: 100 });
      mockEscrowRepo.findOne.mockResolvedValue(escrow);
      mockEscrowRepo.save.mockImplementation(async (e: any) => e);

      const result = await service.releasePartial(testEscrowId, 100);

      expect(result.status).toBe(EscrowStatus.RELEASED);
    });

    it('should throw BadRequestException if released amount is zero', async () => {
      const escrow = makeEscrow({ status: EscrowStatus.LOCKED });
      mockEscrowRepo.findOne.mockResolvedValue(escrow);

      await expect(
        service.releasePartial(testEscrowId, 0),
      ).rejects.toThrow('Released amount must be positive');
    });

    it('should throw BadRequestException if released amount exceeds balance', async () => {
      const escrow = makeEscrow({ status: EscrowStatus.LOCKED, amount: 100 });
      mockEscrowRepo.findOne.mockResolvedValue(escrow);

      await expect(
        service.releasePartial(testEscrowId, 150),
      ).rejects.toThrow('Released amount exceeds escrow balance');
    });

    it('should throw BadRequestException for invalid status transition', async () => {
      const escrow = makeEscrow({ status: EscrowStatus.RELEASED });
      mockEscrowRepo.findOne.mockResolvedValue(escrow);

      await expect(
        service.releasePartial(testEscrowId, 50),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle transaction failure gracefully', async () => {
      const escrow = makeEscrow({ status: EscrowStatus.LOCKED, amount: 100 });
      mockEscrowRepo.findOne.mockResolvedValue(escrow);
      mockEscrowRepo.save
        .mockRejectedValueOnce(new Error('Stellar transaction failed'))
        .mockImplementation(async (e: any) => e);

      await expect(
        service.releasePartial(testEscrowId, 50),
      ).rejects.toThrow();
    });
  });

  describe('freezeEscrow', () => {
    it('should freeze a LOCKED escrow', async () => {
      const escrow = makeEscrow({ status: EscrowStatus.LOCKED });
      mockEscrowRepo.findOne.mockResolvedValue(escrow);
      mockEscrowRepo.save.mockImplementation(async (e: any) => e);

      const result = await service.freezeEscrow(testEscrowId);

      expect(result.status).toBe(EscrowStatus.FROZEN);
    });

    it('should throw NotFoundException if escrow not found', async () => {
      mockEscrowRepo.findOne.mockResolvedValue(null);

      await expect(service.freezeEscrow('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException for invalid status transition', async () => {
      const escrow = makeEscrow({ status: EscrowStatus.RELEASED });
      mockEscrowRepo.findOne.mockResolvedValue(escrow);

      await expect(service.freezeEscrow(testEscrowId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('adminReleaseFunds', () => {
    it('should release frozen escrow with valid distribution', async () => {
      const escrow = makeEscrow({ status: EscrowStatus.FROZEN, amount: 100 });
      mockEscrowRepo.findOne.mockResolvedValue(escrow);
      mockEscrowRepo.save.mockImplementation(async (e: any) => e);

      const result = await service.adminReleaseFunds(testEscrowId, {
        toSeller: 70,
        toBuyer: 30,
      });

      expect(result.status).toBe(EscrowStatus.RELEASED);
    });

    it('should throw BadRequestException if escrow is not FROZEN', async () => {
      const escrow = makeEscrow({ status: EscrowStatus.LOCKED });
      mockEscrowRepo.findOne.mockResolvedValue(escrow);

      await expect(
        service.adminReleaseFunds(testEscrowId, {
          toSeller: 70,
          toBuyer: 30,
        }),
      ).rejects.toThrow('Can only release frozen escrow');
    });

    it('should throw BadRequestException if distribution does not equal total', async () => {
      const escrow = makeEscrow({ status: EscrowStatus.FROZEN, amount: 100 });
      mockEscrowRepo.findOne.mockResolvedValue(escrow);

      await expect(
        service.adminReleaseFunds(testEscrowId, {
          toSeller: 50,
          toBuyer: 30,
        }),
      ).rejects.toThrow('Distribution must equal total escrow amount');
    });

    it('should handle release with zero toSeller', async () => {
      const escrow = makeEscrow({ status: EscrowStatus.FROZEN, amount: 100 });
      mockEscrowRepo.findOne.mockResolvedValue(escrow);
      mockEscrowRepo.save.mockImplementation(async (e: any) => e);

      const result = await service.adminReleaseFunds(testEscrowId, {
        toSeller: 0,
        toBuyer: 100,
      });

      expect(result.status).toBe(EscrowStatus.RELEASED);
    });

    it('should handle release with zero toBuyer', async () => {
      const escrow = makeEscrow({ status: EscrowStatus.FROZEN, amount: 100 });
      mockEscrowRepo.findOne.mockResolvedValue(escrow);
      mockEscrowRepo.save.mockImplementation(async (e: any) => e);

      const result = await service.adminReleaseFunds(testEscrowId, {
        toSeller: 100,
        toBuyer: 0,
      });

      expect(result.status).toBe(EscrowStatus.RELEASED);
    });

    it('should throw NotFoundException if escrow not found', async () => {
      mockEscrowRepo.findOne.mockResolvedValue(null);

      await expect(
        service.adminReleaseFunds('nonexistent', {
          toSeller: 70,
          toBuyer: 30,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('refundBuyer', () => {
    it('should refund buyer from a LOCKED escrow', async () => {
      const escrow = makeEscrow({ status: EscrowStatus.LOCKED, amount: 100 });
      mockEscrowRepo.findOne.mockResolvedValue(escrow);
      mockEscrowRepo.save.mockImplementation(async (e: any) => e);

      const result = await service.refundBuyer({
        escrowId: testEscrowId,
        reason: 'Item not received',
      });

      expect(result.status).toBe(EscrowStatus.REFUNDED);
      expect(result.refundedAmount).toBe(100);
      expect(result.releasedAmount).toBe(0);
    });

    it('should throw BadRequestException for invalid status transition', async () => {
      const escrow = makeEscrow({ status: EscrowStatus.RELEASED });
      mockEscrowRepo.findOne.mockResolvedValue(escrow);

      await expect(
        service.refundBuyer({ escrowId: testEscrowId, reason: 'test' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow refund from FROZEN status', async () => {
      const escrow = makeEscrow({ status: EscrowStatus.FROZEN, amount: 100 });
      mockEscrowRepo.findOne.mockResolvedValue(escrow);
      mockEscrowRepo.save.mockImplementation(async (e: any) => e);

      const result = await service.refundBuyer({
        escrowId: testEscrowId,
        reason: 'Dispute resolved in buyer favor',
      });

      expect(result.status).toBe(EscrowStatus.REFUNDED);
    });
  });

  describe('getEscrow', () => {
    it('should return escrow when found', async () => {
      const escrow = makeEscrow();
      mockEscrowRepo.findOne.mockResolvedValue(escrow);

      const result = await service.getEscrow(testEscrowId);

      expect(result.id).toBe(testEscrowId);
    });

    it('should throw NotFoundException if escrow not found', async () => {
      mockEscrowRepo.findOne.mockResolvedValue(null);

      await expect(service.getEscrow('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getEscrowByOrderId', () => {
    it('should return escrow when found by orderId', async () => {
      const escrow = makeEscrow();
      mockEscrowRepo.findOne.mockResolvedValue(escrow);

      const result = await service.getEscrowByOrderId(testOrderId);

      expect(result.orderId).toBe(testOrderId);
    });

    it('should throw NotFoundException if no escrow for orderId', async () => {
      mockEscrowRepo.findOne.mockResolvedValue(null);

      await expect(
        service.getEscrowByOrderId('nonexistent-order'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findEscrowOrFail', () => {
    it('should return escrow when found', async () => {
      const escrow = makeEscrow();
      mockEscrowRepo.findOne.mockResolvedValue(escrow);

      const result = await service.findEscrowOrFail(testEscrowId);
      expect(result.id).toBe(testEscrowId);
    });

    it('should throw NotFoundException if not found', async () => {
      mockEscrowRepo.findOne.mockResolvedValue(null);

      await expect(service.findEscrowOrFail('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('status transition validation', () => {
    it('should reject transition from CANCELLED to any status', async () => {
      const escrow = makeEscrow({ status: EscrowStatus.CANCELLED });
      mockEscrowRepo.findOne.mockResolvedValue(escrow);

      await expect(
        service.releaseFunds({ escrowId: testEscrowId, deliveryProof: 'proof' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject transition from REFUNDED to any status', async () => {
      const escrow = makeEscrow({ status: EscrowStatus.REFUNDED });
      mockEscrowRepo.findOne.mockResolvedValue(escrow);

      await expect(
        service.releaseFunds({ escrowId: testEscrowId, deliveryProof: 'proof' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow transition from PARTIALLY_RELEASED to RELEASED', async () => {
      const escrow = makeEscrow({
        status: EscrowStatus.PARTIALLY_RELEASED,
        amount: 100,
      });
      mockEscrowRepo.findOne.mockResolvedValue(escrow);
      mockEscrowRepo.save.mockImplementation(async (e: any) => e);

      const result = await service.releaseFunds({
        escrowId: testEscrowId,
        deliveryProof: 'proof',
      });

      expect(result.status).toBe(EscrowStatus.RELEASED);
    });

    it('should allow refund from PARTIALLY_RELEASED', async () => {
      const escrow = makeEscrow({
        status: EscrowStatus.PARTIALLY_RELEASED,
        amount: 100,
      });
      mockEscrowRepo.findOne.mockResolvedValue(escrow);
      mockEscrowRepo.save.mockImplementation(async (e: any) => e);

      const result = await service.refundBuyer({
        escrowId: testEscrowId,
        reason: 'partial refund',
      });

      expect(result.status).toBe(EscrowStatus.REFUNDED);
    });
  });
});