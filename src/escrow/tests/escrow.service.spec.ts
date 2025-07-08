import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';

// Mock the entities to avoid import issues
const mockEscrowEntity = {
  id: 'escrow123',
  transactionId: 'tx123',
  amount: 100,
  status: 'LOCKED',
  createdAt: new Date(),
  timeoutAt: new Date(Date.now() + 86400000),
  version: 1,
  releasedAt: null,
  releasedTo: null,
  disputeReason: null,
  canTransitionTo: jest.fn().mockReturnValue(true)
};

const mockTransactionEntity = {
  id: 'tx123',
  amount: 100,
  buyerAddress: 'GABC123',
  sellerAddress: 'GDEF456',
  buyerSignature: 'valid-sig'
};

// Create mock entity classes
class MockEscrow {
  id: string;
  transactionId: string;
  amount: number;
  status: string;
  createdAt: Date;
  timeoutAt: Date;
  version: number;
  releasedAt: Date | null;
  releasedTo: string | null;
  disputeReason: string | null;
  canTransitionTo = jest.fn().mockReturnValue(true);
}

class MockTransaction {
  id: string;
  amount: number;
  buyerAddress: string;
  sellerAddress: string;
  buyerSignature: string;
}

// Mock the imports to avoid dependency issues
jest.mock('../escrow.entity', () => ({
  Escrow: MockEscrow,
  EscrowStatus: {
    PENDING: 'PENDING',
    LOCKED: 'LOCKED',
    RELEASED: 'RELEASED',
    DISPUTED: 'DISPUTED',
    REFUNDED: 'REFUNDED'
  }
}));

jest.mock('../../transactions/entities/transaction.entity', () => ({
  Transaction: MockTransaction
}));

// Import after mocking
import { EscrowService } from '../escrow.service';

describe('EscrowService', () => {
  let service: EscrowService;
  let escrowRepository: any;
  let transactionRepository: any;
  let dataSource: any;
  let configService: ConfigService;
  let schedulerRegistry: SchedulerRegistry;

  // Clean up after each test
  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  // Clean up after all tests
  afterAll(() => {
    jest.useRealTimers();
  });

  const createMockEscrow = (overrides: any = {}) => ({
    ...mockEscrowEntity,
    ...overrides
  });

  const createMockTransaction = (overrides: any = {}) => ({
    ...mockTransactionEntity,
    ...overrides
  });

  beforeEach(async () => {
    // Use fake timers to prevent hanging
    jest.useFakeTimers();
    
    const mockEntityManager = {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      delete: jest.fn()
    };

    escrowRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      create: jest.fn()
    };

    transactionRepository = {
      findOne: jest.fn()
    };

    dataSource = {
      transaction: jest.fn().mockImplementation((callback) => callback(mockEntityManager))
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EscrowService,
        {
          provide: getRepositoryToken(MockEscrow),
          useValue: escrowRepository
        },
        {
          provide: getRepositoryToken(MockTransaction),
          useValue: transactionRepository
        },
        {
          provide: DataSource,
          useValue: dataSource
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(86400)
          }
        },
        {
          provide: SchedulerRegistry,
          useValue: {
            addCronJob: jest.fn(),
            deleteCronJob: jest.fn()
          }
        }
      ],
    }).compile();

    service = module.get<EscrowService>(EscrowService);
    configService = module.get<ConfigService>(ConfigService);
    schedulerRegistry = module.get<SchedulerRegistry>(SchedulerRegistry);
  });

  describe('createEscrow', () => {
    it('should create escrow and lock funds successfully', async () => {
      const mockTransaction = createMockTransaction();
      const mockEscrow = createMockEscrow({ status: 'PENDING' });
      const mockEntityManager = {
        findOne: jest.fn().mockResolvedValue(mockTransaction),
        save: jest.fn().mockResolvedValue({ ...mockEscrow, status: 'LOCKED' }),
        create: jest.fn().mockReturnValue(mockEscrow),
        delete: jest.fn()
      };

      dataSource.transaction.mockImplementation((callback) => callback(mockEntityManager));

      const createEscrowDto = {
        transactionId: 'tx123',
        amount: 100,
        timeoutHours: 24,
        buyerAddress: 'GABC123',
        sellerAddress: 'GDEF456',
        memo: 'Test escrow'
      };

      const result = await service.createEscrow(createEscrowDto);

      expect(mockEntityManager.findOne).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          where: { id: 'tx123' },
          lock: { mode: 'pessimistic_write' }
        })
      );
      expect(mockEntityManager.create).toHaveBeenCalled();
      expect(mockEntityManager.save).toHaveBeenCalledTimes(2);
      expect(result.status).toBe('LOCKED');
    });

    it('should throw error if transaction not found', async () => {
      const mockEntityManager = {
        findOne: jest.fn().mockResolvedValue(null),
        save: jest.fn(),
        create: jest.fn(),
        delete: jest.fn()
      };

      dataSource.transaction.mockImplementation((callback) => callback(mockEntityManager));

      const createEscrowDto = {
        transactionId: 'invalid-tx',
        amount: 100,
        timeoutHours: 24,
        buyerAddress: 'GABC123',
        sellerAddress: 'GDEF456',
        memo: 'Test escrow'
      };

      await expect(service.createEscrow(createEscrowDto)).rejects.toThrow('Transaction not found');
    });
  });

  describe('releaseFunds', () => {
    it('should release funds successfully with valid buyer signature', async () => {
      const mockEscrow = createMockEscrow({ 
        status: 'LOCKED',
        canTransitionTo: jest.fn().mockReturnValue(true)
      });
      const mockTransaction = createMockTransaction();
      const mockEntityManager = {
        findOne: jest.fn().mockResolvedValue(mockEscrow),
        save: jest.fn().mockResolvedValue({ ...mockEscrow, status: 'RELEASED' })
      };

      dataSource.transaction.mockImplementation((callback) => callback(mockEntityManager));
      transactionRepository.findOne.mockResolvedValue(mockTransaction);

      const releaseDto = {
        escrowId: 'escrow123',
        buyerSignature: 'valid-sig'
      };

      const result = await service.releaseFunds(releaseDto);

      expect(mockEntityManager.findOne).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          where: { id: 'escrow123' },
          lock: { mode: 'pessimistic_write' }
        })
      );
      expect(result).toBe('stellar-release-tx-escrow123');
    });

    it('should throw error if escrow not found', async () => {
      const mockEntityManager = {
        findOne: jest.fn().mockResolvedValue(null),
        save: jest.fn()
      };

      dataSource.transaction.mockImplementation((callback) => callback(mockEntityManager));

      const releaseDto = {
        escrowId: 'invalid-escrow',
        buyerSignature: 'valid-sig'
      };

      await expect(service.releaseFunds(releaseDto)).rejects.toThrow('Escrow not found');
    });

    it('should throw error for invalid buyer signature', async () => {
      const mockEscrow = createMockEscrow({ 
        status: 'LOCKED',
        canTransitionTo: jest.fn().mockReturnValue(true)
      });
      const mockTransaction = createMockTransaction();
      const mockEntityManager = {
        findOne: jest.fn().mockResolvedValue(mockEscrow),
        save: jest.fn()
      };

      dataSource.transaction.mockImplementation((callback) => callback(mockEntityManager));
      transactionRepository.findOne.mockResolvedValue(mockTransaction);

      const releaseDto = {
        escrowId: 'escrow123',
        buyerSignature: 'invalid-sig'
      };

      await expect(service.releaseFunds(releaseDto)).rejects.toThrow('Invalid buyer confirmation');
    });
  });

  describe('handlePartialRelease', () => {
    it('should handle partial release successfully', async () => {
      const mockEscrow = createMockEscrow({ amount: 100 });
      const mockEntityManager = {
        findOne: jest.fn().mockResolvedValue(mockEscrow),
        save: jest.fn().mockResolvedValue({ ...mockEscrow, amount: 50 })
      };

      dataSource.transaction.mockImplementation((callback) => callback(mockEntityManager));

      const partialReleaseDto = {
        escrowId: 'escrow123',
        amount: 50,
        recipientAddress: 'GDEF456',
        reason: 'Partial delivery'
      };

      const result = await service.handlePartialRelease(partialReleaseDto);

      expect(mockEntityManager.findOne).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          where: { id: 'escrow123' },
          lock: { mode: 'pessimistic_write' }
        })
      );
      expect(result).toBe('stellar-release-tx-escrow123');
    });

    it('should throw error if partial amount exceeds escrow amount', async () => {
      const mockEscrow = createMockEscrow({ amount: 100 });
      const mockEntityManager = {
        findOne: jest.fn().mockResolvedValue(mockEscrow),
        save: jest.fn()
      };

      dataSource.transaction.mockImplementation((callback) => callback(mockEntityManager));

      const partialReleaseDto = {
        escrowId: 'escrow123',
        amount: 150,
        recipientAddress: 'GDEF456'
      };

      await expect(service.handlePartialRelease(partialReleaseDto)).rejects.toThrow('Partial release amount exceeds escrow amount');
    });
  });

  describe('initiateDispute', () => {
    it('should initiate dispute successfully', async () => {
      const mockEscrow = createMockEscrow({ 
        status: 'LOCKED',
        canTransitionTo: jest.fn().mockReturnValue(true)
      });
      const mockEntityManager = {
        findOne: jest.fn().mockResolvedValue(mockEscrow),
        save: jest.fn().mockResolvedValue({ ...mockEscrow, status: 'DISPUTED' })
      };

      dataSource.transaction.mockImplementation((callback) => callback(mockEntityManager));

      const disputeDto = {
        escrowId: 'escrow123',
        reason: 'Product not as described',
        initiatorSignature: 'dispute-sig'
      };

      const result = await service.initiateDispute(disputeDto);

      expect(mockEntityManager.findOne).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          where: { id: 'escrow123' },
          lock: { mode: 'pessimistic_write' }
        })
      );
      expect(result.status).toBe('DISPUTED');
    });

    it('should throw error if escrow cannot transition to disputed', async () => {
      const mockEscrow = createMockEscrow({ 
        status: 'RELEASED',
        canTransitionTo: jest.fn().mockReturnValue(false)
      });
      const mockEntityManager = {
        findOne: jest.fn().mockResolvedValue(mockEscrow),
        save: jest.fn()
      };

      dataSource.transaction.mockImplementation((callback) => callback(mockEntityManager));

      const disputeDto = {
        escrowId: 'escrow123',
        reason: 'Product not as described',
        initiatorSignature: 'dispute-sig'
      };

      await expect(service.initiateDispute(disputeDto)).rejects.toThrow('Invalid escrow status for dispute');
    });
  });

  describe('resolveDispute', () => {
    it('should resolve dispute with release', async () => {
      const mockEscrow = createMockEscrow({ status: 'DISPUTED' });
      const mockTransaction = createMockTransaction();
      const mockEntityManager = {
        findOne: jest.fn().mockResolvedValue(mockEscrow),
        save: jest.fn().mockResolvedValue({ ...mockEscrow, status: 'RELEASED' })
      };

      dataSource.transaction.mockImplementation((callback) => callback(mockEntityManager));
      transactionRepository.findOne.mockResolvedValue(mockTransaction);

      const result = await service.resolveDispute('escrow123', 'release');

      expect(mockEntityManager.findOne).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          where: { id: 'escrow123' },
          lock: { mode: 'pessimistic_write' }
        })
      );
      expect(result).toBe('stellar-release-tx-escrow123');
    });

    it('should resolve dispute with refund', async () => {
      const mockEscrow = createMockEscrow({ status: 'DISPUTED' });
      const mockTransaction = createMockTransaction();
      const mockEntityManager = {
        findOne: jest.fn().mockResolvedValue(mockEscrow),
        save: jest.fn().mockResolvedValue({ ...mockEscrow, status: 'REFUNDED' })
      };

      dataSource.transaction.mockImplementation((callback) => callback(mockEntityManager));
      transactionRepository.findOne.mockResolvedValue(mockTransaction);

      const result = await service.resolveDispute('escrow123', 'refund');

      expect(result).toBe('stellar-release-tx-escrow123');
    });

    it('should throw error if escrow is not disputed', async () => {
      const mockEscrow = createMockEscrow({ status: 'LOCKED' });
      const mockEntityManager = {
        findOne: jest.fn().mockResolvedValue(mockEscrow),
        save: jest.fn()
      };

      dataSource.transaction.mockImplementation((callback) => callback(mockEntityManager));

      await expect(service.resolveDispute('escrow123', 'release')).rejects.toThrow('Escrow is not in disputed state');
    });
  });

  describe('getEscrowStatus', () => {
    it('should return escrow status', async () => {
      const mockEscrow = createMockEscrow();
      escrowRepository.findOne.mockResolvedValue(mockEscrow);

      const result = await service.getEscrowStatus('escrow123');

      expect(escrowRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'escrow123' },
        relations: ['transaction']
      });
      expect(result).toEqual(mockEscrow);
    });

    it('should throw error if escrow not found', async () => {
      escrowRepository.findOne.mockResolvedValue(null);

      await expect(service.getEscrowStatus('invalid-escrow')).rejects.toThrow('Escrow not found');
    });
  });

  describe('handleAutoRelease', () => {
    it('should auto-release expired escrows', async () => {
      const expiredEscrow = createMockEscrow({ 
        status: 'LOCKED',
        timeoutAt: new Date(Date.now() - 1000) // Past timeout
      });
      
      escrowRepository.find.mockResolvedValue([expiredEscrow]);

      // Mock the releaseFunds method
      const releaseFundsSpy = jest.spyOn(service, 'releaseFunds').mockResolvedValue('stellar-release-tx-escrow123');

      await service.handleAutoRelease();

      expect(escrowRepository.find).toHaveBeenCalledWith({
        where: {
          status: 'LOCKED',
          timeoutAt: expect.any(Object)
        }
      });
      expect(releaseFundsSpy).toHaveBeenCalledWith({
        escrowId: 'escrow123',
        buyerSignature: 'AUTO_RELEASE'
      });
    });
  });
});
