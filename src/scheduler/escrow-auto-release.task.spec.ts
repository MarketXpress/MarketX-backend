import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EscrowAutoReleaseTask } from './escrow-auto-release.task';
import { EscrowEntity, EscrowStatus } from '../escrowes/entities/escrow.entity';
import { Order, OrderStatus } from '../entities/order.entity';
import { Dispute, DisputeStatus } from '../disputes/dispute.entity';
import { EscrowService } from '../escrowes/escrow.service';
import { WalletService } from '../wallet/wallet.service';
import { EventNames } from '../common/events';

describe('EscrowAutoReleaseTask', () => {
  let task: EscrowAutoReleaseTask;
  let escrowRepository: any;
  let orderRepository: any;
  let disputeRepository: any;
  let escrowService: any;
  let walletService: any;
  let eventEmitter: any;

  const mockEscrowRepository = {
    find: jest.fn(),
    save: jest.fn(),
  };

  const mockOrderRepository = {
    findOne: jest.fn(),
  };

  const mockDisputeRepository = {
    findOne: jest.fn(),
  };

  const mockEscrowService = {
    releaseFunds: jest.fn(),
  };

  const mockWalletService = {
    // Mock methods if needed
  };

  const mockEventEmitter = {
    emit: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EscrowAutoReleaseTask,
        {
          provide: getRepositoryToken(EscrowEntity),
          useValue: mockEscrowRepository,
        },
        {
          provide: getRepositoryToken(Order),
          useValue: mockOrderRepository,
        },
        {
          provide: getRepositoryToken(Dispute),
          useValue: mockDisputeRepository,
        },
        {
          provide: EscrowService,
          useValue: mockEscrowService,
        },
        {
          provide: WalletService,
          useValue: mockWalletService,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
      ],
    }).compile();

    task = module.get<EscrowAutoReleaseTask>(EscrowAutoReleaseTask);
    escrowRepository = module.get(getRepositoryToken(EscrowEntity));
    orderRepository = module.get(getRepositoryToken(Order));
    disputeRepository = module.get(getRepositoryToken(Dispute));
    escrowService = module.get(EscrowService);
    walletService = module.get(WalletService);
    eventEmitter = module.get(EventEmitter2);

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('handleEscrowAutoRelease', () => {
    it('should find and process eligible escrows', async () => {
      const mockEscrow = createMockEscrow({
        id: 'escrow-1',
        status: EscrowStatus.LOCKED,
        disputeFlag: false,
        orderId: 'order-1',
        amount: 100,
        sellerPublicKey: 'GC123...',
      });

      const mockOrder = createMockOrder({
        id: 'order-1',
        status: OrderStatus.DELIVERED,
        deliveredAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000), // 8 days ago
      });

      const mockReleasedEscrow = {
        ...mockEscrow,
        releaseTransactionHash: 'tx-hash-123',
        status: EscrowStatus.RELEASED,
      };

      mockEscrowRepository.find.mockResolvedValue([mockEscrow]);
      mockOrderRepository.findOne.mockResolvedValue(mockOrder);
      mockDisputeRepository.findOne.mockResolvedValue(null); // No active dispute
      mockEscrowService.releaseFunds.mockResolvedValue(mockReleasedEscrow);

      await task.handleEscrowAutoRelease();

      expect(mockEscrowRepository.find).toHaveBeenCalledWith({
        where: {
          status: EscrowStatus.LOCKED,
          disputeFlag: false,
        },
      });
      expect(mockEscrowService.releaseFunds).toHaveBeenCalled();
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        EventNames.PAYMENT_RELEASED,
        expect.objectContaining({
          escrowId: 'escrow-1',
          orderId: 'order-1',
          amount: 100,
          autoReleased: true,
        }),
      );
    });

    it('should skip escrows with disputeFlag true', async () => {
      const mockEscrow = createMockEscrow({
        id: 'escrow-1',
        status: EscrowStatus.LOCKED,
        disputeFlag: true, // Dispute flag is true
        orderId: 'order-1',
      });

      mockEscrowRepository.find.mockResolvedValue([mockEscrow]);

      await task.handleEscrowAutoRelease();

      expect(mockEscrowRepository.find).toHaveBeenCalled();
      expect(mockEscrowService.releaseFunds).not.toHaveBeenCalled();
    });

    it('should skip escrows with order status not DELIVERED', async () => {
      const mockEscrow = createMockEscrow({
        id: 'escrow-1',
        status: EscrowStatus.LOCKED,
        disputeFlag: false,
        orderId: 'order-1',
      });

      const mockOrder = createMockOrder({
        id: 'order-1',
        status: OrderStatus.SHIPPED, // Not DELIVERED
      });

      mockEscrowRepository.find.mockResolvedValue([mockEscrow]);
      mockOrderRepository.findOne.mockResolvedValue(mockOrder);

      await task.handleEscrowAutoRelease();

      expect(mockEscrowRepository.find).toHaveBeenCalled();
      expect(mockEscrowService.releaseFunds).not.toHaveBeenCalled();
    });

    it('should skip escrows where 7 days have not passed since delivery', async () => {
      const mockEscrow = createMockEscrow({
        id: 'escrow-1',
        status: EscrowStatus.LOCKED,
        disputeFlag: false,
        orderId: 'order-1',
      });

      const mockOrder = createMockOrder({
        id: 'order-1',
        status: OrderStatus.DELIVERED,
        deliveredAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // Only 3 days ago
      });

      mockEscrowRepository.find.mockResolvedValue([mockEscrow]);
      mockOrderRepository.findOne.mockResolvedValue(mockOrder);

      await task.handleEscrowAutoRelease();

      expect(mockEscrowRepository.find).toHaveBeenCalled();
      expect(mockEscrowService.releaseFunds).not.toHaveBeenCalled();
    });

    it('should skip escrows with active disputes and set disputeFlag', async () => {
      const mockEscrow = createMockEscrow({
        id: 'escrow-1',
        status: EscrowStatus.LOCKED,
        disputeFlag: false,
        orderId: 'order-1',
        amount: 100,
        sellerPublicKey: 'GC123...',
      });

      const mockOrder = createMockOrder({
        id: 'order-1',
        status: OrderStatus.DELIVERED,
        deliveredAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      });

      const mockDispute = createMockDispute({
        id: 'dispute-1',
        escrowId: 'escrow-1',
        status: DisputeStatus.OPEN,
      });

      mockEscrowRepository.find.mockResolvedValue([mockEscrow]);
      mockOrderRepository.findOne.mockResolvedValue(mockOrder);
      mockDisputeRepository.findOne.mockResolvedValue(mockDispute); // Active dispute exists

      await task.handleEscrowAutoRelease();

      expect(mockEscrowRepository.find).toHaveBeenCalled();
      expect(mockEscrowService.releaseFunds).not.toHaveBeenCalled();
      expect(mockEscrowRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          disputeFlag: true,
        }),
      );
    });

    it('should handle release failures gracefully', async () => {
      const mockEscrow = createMockEscrow({
        id: 'escrow-1',
        status: EscrowStatus.LOCKED,
        disputeFlag: false,
        orderId: 'order-1',
        amount: 100,
        sellerPublicKey: 'GC123...',
      });

      const mockOrder = createMockOrder({
        id: 'order-1',
        status: OrderStatus.DELIVERED,
        deliveredAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      });

      mockEscrowRepository.find.mockResolvedValue([mockEscrow]);
      mockOrderRepository.findOne.mockResolvedValue(mockOrder);
      mockDisputeRepository.findOne.mockResolvedValue(null);
      mockEscrowService.releaseFunds.mockRejectedValue(new Error('Blockchain error'));

      // Should not throw
      await expect(task.handleEscrowAutoRelease()).resolves.not.toThrow();
    });
  });

  describe('triggerManualRelease', () => {
    it('should return counts of released and failed escrows', async () => {
      const mockEscrow = createMockEscrow({
        id: 'escrow-1',
        status: EscrowStatus.LOCKED,
        disputeFlag: false,
        orderId: 'order-1',
        amount: 100,
        sellerPublicKey: 'GC123...',
      });

      const mockOrder = createMockOrder({
        id: 'order-1',
        status: OrderStatus.DELIVERED,
        deliveredAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      });

      const mockReleasedEscrow = {
        ...mockEscrow,
        releaseTransactionHash: 'tx-hash-123',
        status: EscrowStatus.RELEASED,
      };

      mockEscrowRepository.find.mockResolvedValue([mockEscrow]);
      mockOrderRepository.findOne.mockResolvedValue(mockOrder);
      mockDisputeRepository.findOne.mockResolvedValue(null);
      mockEscrowService.releaseFunds.mockResolvedValue(mockReleasedEscrow);

      const result = await task.triggerManualRelease();

      expect(result).toEqual({
        released: 1,
        failed: 0,
      });
    });
  });
});

// Helper functions to create mock objects
function createMockEscrow(overrides: Partial<EscrowEntity> = {}): EscrowEntity {
  return {
    id: 'escrow-1',
    orderId: 'order-1',
    buyerPublicKey: 'GB123...',
    sellerPublicKey: 'GC123...',
    amount: 100,
    escrowAccountPublicKey: 'GA123...',
    status: EscrowStatus.LOCKED,
    disputeFlag: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as EscrowEntity;
}

function createMockOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-1',
    totalAmount: 100,
    status: OrderStatus.PENDING,
    items: [],
    shippingAddress: '123 Test St',
    buyerId: 'buyer-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Order;
}

function createMockDispute(overrides: Partial<Dispute> = {}): Dispute {
  return {
    id: 'dispute-1',
    transactionId: 'tx-1',
    complainantId: 'user-1',
    respondentId: 'user-2',
    reason: 'Item not received',
    status: DisputeStatus.OPEN,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Dispute;
}
