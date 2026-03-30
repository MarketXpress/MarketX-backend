import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { RefundsService } from './refunds.service';
import { ReturnRequest, ReturnStatus, RefundType, ReturnReason } from './entities/return-request.entity';
import { RefundHistory } from './entities/refund-history.entity';
import { Order } from '../orders/entities/order.entity';
import { OrderStatus } from '../orders/dto/create-order.dto';
import { SupportedCurrency } from '../products/services/pricing.service';
import { InventoryService } from '../inventory/inventory.service';
import { EventNames } from '../common/events';

describe('RefundsService', () => {
  let service: RefundsService;
  let mockReturnRequestRepo: any;
  let mockRefundHistoryRepo: any;
  let mockOrderRepo: any;
  let mockInventoryService: any;
  let mockEventEmitter: any;

  const testOrderId = 'order-1';
  const testBuyerId = 'buyer-1';
  const testSellerId = 'seller-1';
  const testReturnRequestId = 'rr-1';

  const makeDeliveredOrder = (overrides: Partial<Order> = {}): Partial<Order> => ({
    id: testOrderId,
    buyerId: testBuyerId,
    status: OrderStatus.DELIVERED,
    totalAmount: 200,
    deliveredAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
    items: [
      { productId: 'prod-1', quantity: 1, price: 200 } as any,
    ],
    currency: SupportedCurrency.USD,
    ...overrides,
  });

  const makeCreateDto = (overrides: Partial<any> = {}) => ({
    orderId: testOrderId,
    buyerId: testBuyerId,
    sellerId: testSellerId,
    reason: ReturnReason.DEFECTIVE,
    refundType: RefundType.FULL,
    returnWindowDays: 30,
    ...overrides,
  });

  beforeEach(async () => {
    mockReturnRequestRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
    };

    mockRefundHistoryRepo = {
      create: jest.fn(),
      save: jest.fn(),
    };

    mockOrderRepo = {
      findOne: jest.fn(),
    };

    mockInventoryService = {
      restoreInventoryFromRefund: jest.fn().mockResolvedValue(undefined),
    };

    mockEventEmitter = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefundsService,
        {
          provide: getRepositoryToken(ReturnRequest),
          useValue: mockReturnRequestRepo,
        },
        {
          provide: getRepositoryToken(RefundHistory),
          useValue: mockRefundHistoryRepo,
        },
        {
          provide: getRepositoryToken(Order),
          useValue: mockOrderRepo,
        },
        { provide: InventoryService, useValue: mockInventoryService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<RefundsService>(RefundsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────
  // createReturnRequest
  // ─────────────────────────────────────────────────────────────

  describe('createReturnRequest', () => {
    it('should throw NotFoundException when order does not exist', async () => {
      mockOrderRepo.findOne.mockResolvedValue(null);

      await expect(service.createReturnRequest(makeCreateDto())).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException when buyerId does not match order owner', async () => {
      mockOrderRepo.findOne.mockResolvedValue(
        makeDeliveredOrder({ buyerId: 'other-buyer' }),
      );

      await expect(service.createReturnRequest(makeCreateDto())).rejects.toThrow(
        ForbiddenException,
      );
    });

    // ── MUTATION TARGET: order.status !== 'delivered' ────────────────────
    it('should throw BadRequestException when order is PENDING (not delivered)', async () => {
      mockOrderRepo.findOne.mockResolvedValue(
        makeDeliveredOrder({ status: OrderStatus.PENDING }),
      );

      await expect(service.createReturnRequest(makeCreateDto())).rejects.toThrow(
        'Only delivered orders can be refunded',
      );
    });

    it('should throw BadRequestException when order is PAID (not delivered)', async () => {
      mockOrderRepo.findOne.mockResolvedValue(
        makeDeliveredOrder({ status: OrderStatus.PAID }),
      );

      await expect(service.createReturnRequest(makeCreateDto())).rejects.toThrow(
        'Only delivered orders can be refunded',
      );
    });

    it('should NOT throw for a DELIVERED order (inverse guard)', async () => {
      const order = makeDeliveredOrder();
      mockOrderRepo.findOne.mockResolvedValue(order);
      mockReturnRequestRepo.findOne.mockResolvedValue(null);
      const saved = { id: testReturnRequestId, ...makeCreateDto() };
      mockReturnRequestRepo.create.mockReturnValue(saved);
      mockReturnRequestRepo.save.mockResolvedValue(saved);

      await expect(
        service.createReturnRequest(makeCreateDto()),
      ).resolves.not.toThrow();
    });

    it('should throw BadRequestException when deliveredAt is missing', async () => {
      mockOrderRepo.findOne.mockResolvedValue(
        makeDeliveredOrder({ deliveredAt: undefined }),
      );

      await expect(service.createReturnRequest(makeCreateDto())).rejects.toThrow(
        'Order has no delivery date recorded',
      );
    });

    // ── MUTATION TARGET: diffDays > maxReturnDays ────────────────────────
    it('should throw BadRequestException when return window has expired', async () => {
      const expiredDelivery = new Date(
        Date.now() - 31 * 24 * 60 * 60 * 1000, // 31 days ago
      );
      mockOrderRepo.findOne.mockResolvedValue(
        makeDeliveredOrder({ deliveredAt: expiredDelivery }),
      );

      await expect(
        service.createReturnRequest(makeCreateDto({ returnWindowDays: 30 })),
      ).rejects.toThrow('Return window of 30 days has expired');
    });

    it('should NOT throw when order was delivered just within the window (29 days ago)', async () => {
      const recentDelivery = new Date(
        Date.now() - 29 * 24 * 60 * 60 * 1000, // 29 days ago
      );
      const order = makeDeliveredOrder({ deliveredAt: recentDelivery });
      mockOrderRepo.findOne.mockResolvedValue(order);
      mockReturnRequestRepo.findOne.mockResolvedValue(null);
      const saved = { id: testReturnRequestId, ...makeCreateDto() };
      mockReturnRequestRepo.create.mockReturnValue(saved);
      mockReturnRequestRepo.save.mockResolvedValue(saved);

      await expect(
        service.createReturnRequest(makeCreateDto({ returnWindowDays: 30 })),
      ).resolves.not.toThrow();
    });

    it('should throw BadRequestException when a pending return request already exists', async () => {
      mockOrderRepo.findOne.mockResolvedValue(makeDeliveredOrder());
      mockReturnRequestRepo.findOne.mockResolvedValue({
        id: 'existing-rr',
        status: ReturnStatus.PENDING,
      });

      await expect(service.createReturnRequest(makeCreateDto())).rejects.toThrow(
        'A pending return request already exists for this order',
      );
    });

    it('should throw BadRequestException for PARTIAL refund without items', async () => {
      mockOrderRepo.findOne.mockResolvedValue(makeDeliveredOrder());
      mockReturnRequestRepo.findOne.mockResolvedValue(null);

      await expect(
        service.createReturnRequest(
          makeCreateDto({ refundType: RefundType.PARTIAL, items: [] }),
        ),
      ).rejects.toThrow('Partial refund requires specifying items');
    });

    // ── MUTATION TARGET: finalRefundType === RefundType.FULL ─────────────
    it('should use the full order totalAmount for a FULL refund', async () => {
      const order = makeDeliveredOrder({ totalAmount: 500 });
      mockOrderRepo.findOne.mockResolvedValue(order);
      mockReturnRequestRepo.findOne.mockResolvedValue(null);

      const saved = {
        id: testReturnRequestId,
        requestedAmount: 500,
        refundType: RefundType.FULL,
      };
      mockReturnRequestRepo.create.mockReturnValue(saved);
      mockReturnRequestRepo.save.mockResolvedValue(saved);

      const result = await service.createReturnRequest(
        makeCreateDto({ refundType: RefundType.FULL }),
      );

      expect(result.requestedAmount).toBe(500);
      expect(mockReturnRequestRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ requestedAmount: 500 }),
      );
    });

    it('should sum item prices for a PARTIAL refund (not use totalAmount)', async () => {
      const order = makeDeliveredOrder({
        totalAmount: 500,
        items: [
          { productId: 'prod-1', quantity: 1, price: 50 } as any,
        ],
      });
      mockOrderRepo.findOne.mockResolvedValue(order);
      mockReturnRequestRepo.findOne.mockResolvedValue(null);

      const partialItems = [{ listingId: 'prod-1', quantity: 1 }];
      const saved = {
        id: testReturnRequestId,
        requestedAmount: 50,
        refundType: RefundType.PARTIAL,
      };
      mockReturnRequestRepo.create.mockReturnValue(saved);
      mockReturnRequestRepo.save.mockResolvedValue(saved);

      const result = await service.createReturnRequest(
        makeCreateDto({ refundType: RefundType.PARTIAL, items: partialItems }),
      );

      // Must be the item sum (50), NOT the total (500)
      expect(result.requestedAmount).toBe(50);
      expect(mockReturnRequestRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ requestedAmount: 50 }),
      );
    });

    it('should emit RETURN_REQUESTED event on successful creation', async () => {
      const order = makeDeliveredOrder();
      mockOrderRepo.findOne.mockResolvedValue(order);
      mockReturnRequestRepo.findOne.mockResolvedValue(null);

      const saved = {
        id: testReturnRequestId,
        orderId: testOrderId,
        buyerId: testBuyerId,
        sellerId: testSellerId,
        requestedAmount: 200,
      };
      mockReturnRequestRepo.create.mockReturnValue(saved);
      mockReturnRequestRepo.save.mockResolvedValue(saved);

      await service.createReturnRequest(makeCreateDto());

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        EventNames.RETURN_REQUESTED,
        expect.objectContaining({
          returnRequestId: testReturnRequestId,
          orderId: testOrderId,
          buyerId: testBuyerId,
        }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // reviewReturnRequest
  // ─────────────────────────────────────────────────────────────

  describe('reviewReturnRequest', () => {
    const makePendingReturnRequest = (
      overrides: Partial<ReturnRequest> = {},
    ): Partial<ReturnRequest> => ({
      id: testReturnRequestId,
      orderId: testOrderId,
      buyerId: testBuyerId,
      sellerId: testSellerId,
      status: ReturnStatus.PENDING,
      requestedAmount: 200,
      ...overrides,
    });

    it('should throw NotFoundException when return request does not exist', async () => {
      mockReturnRequestRepo.findOne.mockResolvedValue(null);

      await expect(
        service.reviewReturnRequest(testReturnRequestId, { action: 'approved' }, 'admin-1'),
      ).rejects.toThrow(NotFoundException);
    });

    // ── MUTATION TARGET: returnRequest.status !== ReturnStatus.PENDING ───
    it('should throw BadRequestException when return request is already APPROVED', async () => {
      mockReturnRequestRepo.findOne.mockResolvedValue(
        makePendingReturnRequest({ status: ReturnStatus.APPROVED }),
      );

      await expect(
        service.reviewReturnRequest(testReturnRequestId, { action: 'approved' }, 'admin-1'),
      ).rejects.toThrow('Can only review pending return requests');
    });

    it('should throw BadRequestException when return request is already REJECTED', async () => {
      mockReturnRequestRepo.findOne.mockResolvedValue(
        makePendingReturnRequest({ status: ReturnStatus.REJECTED }),
      );

      await expect(
        service.reviewReturnRequest(testReturnRequestId, { action: 'rejected' }, 'admin-1'),
      ).rejects.toThrow('Can only review pending return requests');
    });

    it('should NOT throw when return request is PENDING (inverse guard)', async () => {
      const rr = makePendingReturnRequest() as ReturnRequest;
      mockReturnRequestRepo.findOne.mockResolvedValue(rr);
      mockReturnRequestRepo.save.mockResolvedValue({
        ...rr,
        status: ReturnStatus.APPROVED,
      });

      await expect(
        service.reviewReturnRequest(testReturnRequestId, { action: 'approved' }, 'admin-1'),
      ).resolves.not.toThrow();
    });

    it('should approve a PENDING return request and set APPROVED status', async () => {
      const rr = makePendingReturnRequest() as ReturnRequest;
      mockReturnRequestRepo.findOne.mockResolvedValue(rr);
      mockReturnRequestRepo.save.mockResolvedValue({
        ...rr,
        status: ReturnStatus.APPROVED,
        reviewedBy: 'admin-1',
      });

      const result = await service.reviewReturnRequest(
        testReturnRequestId,
        { action: 'approved' },
        'admin-1',
      );

      expect(result.status).toBe(ReturnStatus.APPROVED);
      expect(result.reviewedBy).toBe('admin-1');
    });

    it('should reject a PENDING return request and set REJECTED status', async () => {
      const rr = makePendingReturnRequest() as ReturnRequest;
      mockReturnRequestRepo.findOne.mockResolvedValue(rr);
      mockReturnRequestRepo.save.mockResolvedValue({
        ...rr,
        status: ReturnStatus.REJECTED,
        reviewedBy: 'admin-1',
      });

      const result = await service.reviewReturnRequest(
        testReturnRequestId,
        { action: 'rejected', notes: 'Invalid claim' },
        'admin-1',
      );

      expect(result.status).toBe(ReturnStatus.REJECTED);
    });

    // ── MUTATION TARGET: approvedAmount > requestedAmount ────────────────
    it('should throw BadRequestException when approvedAmount exceeds requestedAmount', async () => {
      const rr = makePendingReturnRequest({ requestedAmount: 200 }) as ReturnRequest;
      mockReturnRequestRepo.findOne.mockResolvedValue(rr);

      await expect(
        service.reviewReturnRequest(
          testReturnRequestId,
          { action: 'approved', approvedAmount: 201 }, // 1 more than requested
          'admin-1',
        ),
      ).rejects.toThrow('Approved amount cannot exceed requested amount');
    });

    it('should NOT throw when approvedAmount exactly equals requestedAmount', async () => {
      const rr = makePendingReturnRequest({ requestedAmount: 200 }) as ReturnRequest;
      mockReturnRequestRepo.findOne.mockResolvedValue(rr);
      mockReturnRequestRepo.save.mockResolvedValue({
        ...rr,
        status: ReturnStatus.APPROVED,
        requestedAmount: 200,
      });

      await expect(
        service.reviewReturnRequest(
          testReturnRequestId,
          { action: 'approved', approvedAmount: 200 }, // exactly equal — must NOT throw
          'admin-1',
        ),
      ).resolves.not.toThrow();
    });

    it('should emit RETURN_REVIEWED event with correct status after review', async () => {
      const rr = makePendingReturnRequest() as ReturnRequest;
      mockReturnRequestRepo.findOne.mockResolvedValue(rr);
      mockReturnRequestRepo.save.mockResolvedValue({
        ...rr,
        status: ReturnStatus.APPROVED,
        buyerId: testBuyerId,
        sellerId: testSellerId,
      });

      await service.reviewReturnRequest(
        testReturnRequestId,
        { action: 'approved' },
        'admin-1',
      );

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        EventNames.RETURN_REVIEWED,
        expect.objectContaining({
          returnRequestId: testReturnRequestId,
          status: ReturnStatus.APPROVED,
        }),
      );
    });
  });
});
