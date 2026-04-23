import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { OrdersService } from './orders.service';
import { Order, OrderStatus } from './entities/order.entity';
import { PricingService } from '../products/services/pricing.service';
import { ProductsService } from '../products/products.service';
import { InventoryService } from '../inventory/inventory.service';
import { AdminWebhookService } from '../admin/admin-webhook.service';
import { EventNames } from '../common/events';

describe('OrdersService', () => {
  let service: OrdersService;
  let mockRepository: any;
  let mockEventEmitter: any;
  let mockInventoryService: any;
  let mockDataSource: any;
  let mockManager: any;
  let mockAdminWebhookService: any;
  let mockProductsService: any;

  const testBuyerId = 'buyer-1';
  const testOrderId = 'order-1';

  const makeOrder = (overrides: Partial<Order> = {}): Partial<Order> => ({
    id: testOrderId,
    buyerId: testBuyerId,
    status: OrderStatus.PENDING,
    totalAmount: 100,
    items: [{ productId: 'prod-1', quantity: 2 } as any],
    ...overrides,
  });

  beforeEach(async () => {
    mockRepository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
    };

    mockEventEmitter = { emit: jest.fn() };

    mockInventoryService = {
      reserveInventory: jest.fn().mockResolvedValue(undefined),
      releaseInventory: jest.fn().mockResolvedValue(undefined),
      confirmOrder: jest.fn().mockResolvedValue(undefined),
      cancelOrder: jest.fn().mockResolvedValue(undefined),
    };

    mockAdminWebhookService = {
      notifyAdmin: jest.fn().mockResolvedValue(undefined),
    };

    mockProductsService = {
      findOne: jest.fn().mockReturnValue({
        id: 'prod-1',
        name: 'Test Product',
        price: '50',
        currency: 'USD',
      }),
    };

    mockManager = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
    };

    mockDataSource = {
      transaction: jest.fn((cb: (manager: any) => Promise<any>) =>
        cb(mockManager),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: getRepositoryToken(Order), useValue: mockRepository },
        { provide: DataSource, useValue: mockDataSource },
        { provide: PricingService, useValue: {} },
        { provide: ProductsService, useValue: mockProductsService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
        { provide: InventoryService, useValue: mockInventoryService },
        { provide: AdminWebhookService, useValue: mockAdminWebhookService },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────
  // findAll
  // ─────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return all orders when no buyerId is provided', async () => {
      const orders = [makeOrder()];
      mockRepository.find.mockResolvedValue(orders);

      const result = await service.findAll();

      expect(result).toEqual(orders);
      expect(mockRepository.find).toHaveBeenCalledWith({
        order: { createdAt: 'DESC' },
      });
    });

    it('should return only the buyer orders when buyerId is provided', async () => {
      const orders = [makeOrder()];
      mockRepository.find.mockResolvedValue(orders);

      const result = await service.findAll(testBuyerId);

      expect(result).toEqual(orders);
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { buyerId: testBuyerId },
        order: { createdAt: 'DESC' },
      });
      // Guard: must NOT omit the where clause (kills conditional-removal mutations)
      const callArg = mockRepository.find.mock.calls[0][0];
      expect(callArg).toHaveProperty('where.buyerId', testBuyerId);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // findOne
  // ─────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should return the order when found', async () => {
      const order = makeOrder();
      mockRepository.findOne.mockResolvedValue(order);

      const result = await service.findOne(testOrderId);

      expect(result).toEqual(order);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: testOrderId },
      });
    });

    it('should throw NotFoundException when the order does not exist', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // cancelOrder  — critical status-check mutations
  // ─────────────────────────────────────────────────────────────

  describe('cancelOrder', () => {
    it('should cancel a PENDING order and release inventory', async () => {
      const order = makeOrder({ status: OrderStatus.PENDING });
      mockManager.findOne.mockResolvedValue(order);
      mockManager.save.mockResolvedValue({
        ...order,
        status: OrderStatus.CANCELLED,
      });

      const result = await service.cancelOrder(testOrderId, testBuyerId);

      expect(result.status).toBe(OrderStatus.CANCELLED);
      expect(mockInventoryService.releaseInventory).toHaveBeenCalledWith(
        'prod-1',
        testBuyerId,
        2,
        mockManager,
      );
    });

    // ── MUTATION TARGET: order.status === OrderStatus.CANCELLED ──────────
    it('should throw BadRequestException when order is already CANCELLED', async () => {
      const order = makeOrder({ status: OrderStatus.CANCELLED });
      mockManager.findOne.mockResolvedValue(order);

      await expect(
        service.cancelOrder(testOrderId, testBuyerId),
      ).rejects.toThrow('Order is already cancelled');
    });

    it('should NOT throw for a PENDING order (inverse of the CANCELLED guard)', async () => {
      const order = makeOrder({ status: OrderStatus.PENDING });
      mockManager.findOne.mockResolvedValue(order);
      mockManager.save.mockResolvedValue({
        ...order,
        status: OrderStatus.CANCELLED,
      });

      // Should resolve without throwing
      await expect(
        service.cancelOrder(testOrderId, testBuyerId),
      ).resolves.not.toThrow();
    });

    it('should throw BadRequestException when the order belongs to a different buyer', async () => {
      const order = makeOrder({ buyerId: 'other-buyer' });
      mockManager.findOne.mockResolvedValue(order);

      await expect(
        service.cancelOrder(testOrderId, testBuyerId),
      ).rejects.toThrow('Order not found or unauthorized');
    });

    it('should throw BadRequestException when the order is not found', async () => {
      mockManager.findOne.mockResolvedValue(null);

      await expect(
        service.cancelOrder(testOrderId, testBuyerId),
      ).rejects.toThrow('Order not found or unauthorized');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // updateStatus  — critical PAID / CANCELLED branch mutations
  // ─────────────────────────────────────────────────────────────

  describe('updateStatus', () => {
    const pendingOrder = () =>
      makeOrder({ status: OrderStatus.PENDING }) as Order;

    beforeEach(() => {
      mockRepository.save.mockImplementation((o: Order) =>
        Promise.resolve({ ...o }),
      );
    });

    // ── MUTATION TARGET: status === OrderStatus.PAID ─────────────────────
    it('should call confirmOrder (and only confirmOrder) when status becomes PAID', async () => {
      const order = pendingOrder();
      mockRepository.findOne.mockResolvedValue(order);

      await service.updateStatus(testOrderId, { status: OrderStatus.PAID });

      expect(mockInventoryService.confirmOrder).toHaveBeenCalledWith(order);
      expect(mockInventoryService.cancelOrder).not.toHaveBeenCalled();
    });

    it('should NOT call confirmOrder when status becomes SHIPPED', async () => {
      const order = pendingOrder();
      mockRepository.findOne.mockResolvedValue(order);

      await service.updateStatus(testOrderId, { status: OrderStatus.SHIPPED });

      expect(mockInventoryService.confirmOrder).not.toHaveBeenCalled();
    });

    it('should NOT call confirmOrder when status becomes DELIVERED', async () => {
      const order = pendingOrder();
      mockRepository.findOne.mockResolvedValue(order);

      await service.updateStatus(testOrderId, {
        status: OrderStatus.DELIVERED,
      });

      expect(mockInventoryService.confirmOrder).not.toHaveBeenCalled();
    });

    // ── MUTATION TARGET: status === OrderStatus.CANCELLED ────────────────
    it('should call cancelOrder (and only cancelOrder) when status becomes CANCELLED', async () => {
      const order = pendingOrder();
      mockRepository.findOne.mockResolvedValue(order);

      await service.updateStatus(testOrderId, {
        status: OrderStatus.CANCELLED,
      });

      expect(mockInventoryService.cancelOrder).toHaveBeenCalledWith(order);
      expect(mockInventoryService.confirmOrder).not.toHaveBeenCalled();
    });

    it('should NOT call cancelOrder when status becomes PAID', async () => {
      const order = pendingOrder();
      mockRepository.findOne.mockResolvedValue(order);

      await service.updateStatus(testOrderId, { status: OrderStatus.PAID });

      expect(mockInventoryService.cancelOrder).not.toHaveBeenCalled();
    });

    it('should set cancelledAt when transitioning to CANCELLED', async () => {
      const order = pendingOrder();
      mockRepository.findOne.mockResolvedValue(order);

      const before = Date.now();
      await service.updateStatus(testOrderId, {
        status: OrderStatus.CANCELLED,
      });
      const after = Date.now();

      const savedArg: Order = mockRepository.save.mock.calls[0][0];
      expect(savedArg.cancelledAt).toBeInstanceOf(Date);
      expect(savedArg.cancelledAt!.getTime()).toBeGreaterThanOrEqual(before);
      expect(savedArg.cancelledAt!.getTime()).toBeLessThanOrEqual(after);
    });

    it('should set shippedAt when transitioning to SHIPPED', async () => {
      const order = pendingOrder();
      mockRepository.findOne.mockResolvedValue(order);

      const before = Date.now();
      await service.updateStatus(testOrderId, { status: OrderStatus.SHIPPED });
      const after = Date.now();

      const savedArg: Order = mockRepository.save.mock.calls[0][0];
      expect(savedArg.shippedAt).toBeInstanceOf(Date);
      expect(savedArg.shippedAt!.getTime()).toBeGreaterThanOrEqual(before);
      expect(savedArg.shippedAt!.getTime()).toBeLessThanOrEqual(after);
    });

    it('should set deliveredAt when transitioning to DELIVERED', async () => {
      const order = pendingOrder();
      mockRepository.findOne.mockResolvedValue(order);

      await service.updateStatus(testOrderId, {
        status: OrderStatus.DELIVERED,
      });

      const savedArg: Order = mockRepository.save.mock.calls[0][0];
      expect(savedArg.deliveredAt).toBeInstanceOf(Date);
    });

    it('should emit ORDER_UPDATED with the correct new and previous statuses', async () => {
      const order = pendingOrder();
      mockRepository.findOne.mockResolvedValue(order);
      mockRepository.save.mockResolvedValue({
        ...order,
        status: OrderStatus.PAID,
      });

      await service.updateStatus(testOrderId, { status: OrderStatus.PAID });

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        EventNames.ORDER_UPDATED,
        expect.objectContaining({
          status: OrderStatus.PAID,
          previousStatus: OrderStatus.PENDING,
        }),
      );
    });

    it('should throw NotFoundException when order is not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateStatus('non-existent', { status: OrderStatus.PAID }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
