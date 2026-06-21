import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource } from 'typeorm';
import {
  EventNames,
  OrderCompletedEvent,
  OrderUpdatedEvent,
} from '../common/events';
import { LoggerService } from '../common/logger/logger.service';
import { SupportedCurrency } from '../products/services/pricing.service';
import { ProductsService } from '../products/products.service';
import { Order, OrderStatus, PaymentStatus } from './entities/order.entity';
import { OrdersService } from './orders.service';

// ── Fixtures ───────────────────────────────────────────────────────────────────

const ORDER_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: ORDER_ID,
    buyerId: 'buyer-uuid',
    totalAmount: 100,
    taxAmount: 0,
    shippingCost: 0,
    discountAmount: 0,
    status: OrderStatus.PENDING,
    paymentStatus: PaymentStatus.UNPAID,
    items: [],
    currency: SupportedCurrency.USD,
    releasedAmount: 0,
    remainingAmount: 100,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  } as Order;
}

function makeProduct(overrides: Partial<{ price: string; currency: SupportedCurrency }> = {}) {
  return {
    id: 'product-uuid',
    name: 'Widget',
    price: '50',
    currency: SupportedCurrency.USD,
    ...overrides,
  };
}

// ── Mock factories ─────────────────────────────────────────────────────────────

function makeOrdersRepo() {
  return {
    findOne: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
  };
}

function makeManager() {
  return {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
  };
}

function makeDataSource(manager: ReturnType<typeof makeManager>) {
  return {
    transaction: jest.fn().mockImplementation((cb: (m: typeof manager) => unknown) => cb(manager)),
  };
}

// ── Suite ──────────────────────────────────────────────────────────────────────

describe('OrdersService', () => {
  let service: OrdersService;
  let ordersRepo: ReturnType<typeof makeOrdersRepo>;
  let manager: ReturnType<typeof makeManager>;
  let dataSource: ReturnType<typeof makeDataSource>;
  let productsService: { findOne: jest.Mock };
  let eventEmitter: { emit: jest.Mock };
  let logger: { info: jest.Mock; error: jest.Mock; warn: jest.Mock; debug: jest.Mock };

  beforeEach(() => {
    ordersRepo = makeOrdersRepo();
    manager = makeManager();
    dataSource = makeDataSource(manager);
    productsService = { findOne: jest.fn() };
    eventEmitter = { emit: jest.fn() };
    logger = { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() };

    service = new OrdersService(
      ordersRepo as any,
      dataSource as unknown as DataSource,
      productsService as unknown as ProductsService,
      eventEmitter as unknown as EventEmitter2,
      logger as unknown as LoggerService,
    );
  });

  // ── create() ──────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('creates and returns an order when all products are found', async () => {
      productsService.findOne.mockReturnValue(makeProduct());
      const order = makeOrder();
      manager.create.mockReturnValue(order);
      manager.save.mockResolvedValue(order);

      const result = await service.create({
        buyerId: 'buyer-uuid',
        items: [{ productId: 'product-uuid', quantity: 2 }],
      } as any);

      expect(productsService.findOne).toHaveBeenCalledWith(
        'product-uuid',
        SupportedCurrency.USD,
      );
      expect(manager.create).toHaveBeenCalledWith(
        Order,
        expect.objectContaining({
          buyerId: 'buyer-uuid',
          status: OrderStatus.PENDING,
          paymentStatus: PaymentStatus.UNPAID,
          totalAmount: 100, // price(50) * quantity(2)
        }),
      );
      expect(manager.save).toHaveBeenCalledWith(order);
      expect(result).toEqual(order);
    });

    it('forwards the paymentCurrency from the DTO to productsService.findOne', async () => {
      productsService.findOne.mockReturnValue(makeProduct({ currency: SupportedCurrency.EUR }));
      const order = makeOrder({ currency: SupportedCurrency.EUR });
      manager.create.mockReturnValue(order);
      manager.save.mockResolvedValue(order);

      await service.create({
        buyerId: 'buyer-uuid',
        items: [{ productId: 'product-uuid', quantity: 1 }],
        paymentCurrency: SupportedCurrency.EUR,
      } as any);

      expect(productsService.findOne).toHaveBeenCalledWith(
        'product-uuid',
        SupportedCurrency.EUR,
      );
    });

    it('throws NotFoundException when a product ID is not found', async () => {
      productsService.findOne.mockReturnValue(undefined);

      await expect(
        service.create({
          buyerId: 'buyer-uuid',
          items: [{ productId: 'missing-id', quantity: 1 }],
        } as any),
      ).rejects.toThrow(NotFoundException);

      expect(manager.save).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when the computed order total is zero', async () => {
      productsService.findOne.mockReturnValue(makeProduct({ price: '0' }));

      await expect(
        service.create({
          buyerId: 'buyer-uuid',
          items: [{ productId: 'product-uuid', quantity: 1 }],
        } as any),
      ).rejects.toThrow(BadRequestException);

      expect(manager.save).not.toHaveBeenCalled();
    });
  });

  // ── updateStatus() ────────────────────────────────────────────────────────

  describe('updateStatus()', () => {
    function seedOrder(status: OrderStatus, overrides: Partial<Order> = {}) {
      const order = makeOrder({ status, ...overrides });
      ordersRepo.findOne.mockResolvedValue(order);
      // Return the mutated object so callers can inspect field changes
      ordersRepo.save.mockImplementation(async (o: Order) => o);
      return order;
    }

    it('returns the saved order on a valid transition (PENDING → CONFIRMED)', async () => {
      seedOrder(OrderStatus.PENDING);

      const result = await service.updateStatus(ORDER_ID, {
        status: OrderStatus.CONFIRMED,
      });

      expect(result.status).toBe(OrderStatus.CONFIRMED);
      expect(ordersRepo.save).toHaveBeenCalled();
    });

    it('throws BadRequestException for an invalid transition (PENDING → COMPLETED)', async () => {
      seedOrder(OrderStatus.PENDING);

      await expect(
        service.updateStatus(ORDER_ID, { status: OrderStatus.COMPLETED }),
      ).rejects.toThrow(BadRequestException);

      expect(ordersRepo.save).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when moving out of a terminal CANCELLED state', async () => {
      seedOrder(OrderStatus.CANCELLED);

      await expect(
        service.updateStatus(ORDER_ID, { status: OrderStatus.PENDING }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when moving out of a terminal REFUNDED state', async () => {
      seedOrder(OrderStatus.REFUNDED);

      await expect(
        service.updateStatus(ORDER_ID, { status: OrderStatus.PENDING }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when the order does not exist', async () => {
      ordersRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateStatus('no-such-id', { status: OrderStatus.CONFIRMED }),
      ).rejects.toThrow(NotFoundException);
    });

    it('sets paymentStatus=PAID and confirmedAt when transitioning to PAID', async () => {
      seedOrder(OrderStatus.PROCESSING);

      const result = await service.updateStatus(ORDER_ID, {
        status: OrderStatus.PAID,
      });

      expect(result.paymentStatus).toBe(PaymentStatus.PAID);
      expect(result.confirmedAt).toBeInstanceOf(Date);
    });

    it('sets cancelledAt when transitioning to CANCELLED', async () => {
      seedOrder(OrderStatus.PENDING);

      const result = await service.updateStatus(ORDER_ID, {
        status: OrderStatus.CANCELLED,
      });

      expect(result.cancelledAt).toBeInstanceOf(Date);
    });

    it('sets shippedAt when transitioning to SHIPPED', async () => {
      seedOrder(OrderStatus.PAID);

      const result = await service.updateStatus(ORDER_ID, {
        status: OrderStatus.SHIPPED,
      });

      expect(result.shippedAt).toBeInstanceOf(Date);
    });

    it('sets deliveredAt when transitioning to DELIVERED', async () => {
      seedOrder(OrderStatus.SHIPPED);

      const result = await service.updateStatus(ORDER_ID, {
        status: OrderStatus.DELIVERED,
      });

      expect(result.deliveredAt).toBeInstanceOf(Date);
    });
  });

  // ── EventEmitter2.emit ────────────────────────────────────────────────────

  describe('EventEmitter2.emit', () => {
    function seedOrder(status: OrderStatus) {
      const order = makeOrder({ status });
      ordersRepo.findOne.mockResolvedValue(order);
      ordersRepo.save.mockImplementation(async (o: Order) => o);
      return order;
    }

    it('emits ORDER_UPDATED with the correct event name after any status change', async () => {
      const order = seedOrder(OrderStatus.PENDING);

      await service.updateStatus(ORDER_ID, { status: OrderStatus.CONFIRMED });

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        EventNames.ORDER_UPDATED,
        expect.any(OrderUpdatedEvent),
      );

      const [, payload] = eventEmitter.emit.mock.calls.find(
        ([name]: [string]) => name === EventNames.ORDER_UPDATED,
      )!;

      expect(payload).toMatchObject({
        orderId: order.id,
        userId: order.buyerId,
        orderNumber: `ORD-${order.id.substring(0, 8)}`,
        status: OrderStatus.CONFIRMED,
        previousStatus: OrderStatus.PENDING,
      });
    });

    it('emits ORDER_COMPLETED in addition to ORDER_UPDATED when status becomes COMPLETED', async () => {
      const order = seedOrder(OrderStatus.DELIVERED);

      await service.updateStatus(ORDER_ID, { status: OrderStatus.COMPLETED });

      const emittedNames = eventEmitter.emit.mock.calls.map(([name]: [string]) => name);
      expect(emittedNames).toContain(EventNames.ORDER_UPDATED);
      expect(emittedNames).toContain(EventNames.ORDER_COMPLETED);

      const [, completedPayload] = eventEmitter.emit.mock.calls.find(
        ([name]: [string]) => name === EventNames.ORDER_COMPLETED,
      )!;

      expect(completedPayload).toBeInstanceOf(OrderCompletedEvent);
      expect(completedPayload).toMatchObject({
        orderId: order.id,
        userId: order.buyerId,
        orderNumber: `ORD-${order.id.substring(0, 8)}`,
        totalAmount: Number(order.totalAmount),
      });
    });

    it('does NOT emit ORDER_COMPLETED for non-COMPLETED transitions', async () => {
      seedOrder(OrderStatus.PENDING);

      await service.updateStatus(ORDER_ID, { status: OrderStatus.CONFIRMED });

      const emittedNames = eventEmitter.emit.mock.calls.map(([name]: [string]) => name);
      expect(emittedNames).not.toContain(EventNames.ORDER_COMPLETED);
    });

    it('emits exactly once for a regular status change (no extra ORDER_COMPLETED)', async () => {
      seedOrder(OrderStatus.CONFIRMED);

      await service.updateStatus(ORDER_ID, { status: OrderStatus.PROCESSING });

      expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        EventNames.ORDER_UPDATED,
        expect.any(OrderUpdatedEvent),
      );
    });

    it('emits exactly twice when transitioning to COMPLETED', async () => {
      seedOrder(OrderStatus.DELIVERED);

      await service.updateStatus(ORDER_ID, { status: OrderStatus.COMPLETED });

      expect(eventEmitter.emit).toHaveBeenCalledTimes(2);
    });
  });
});
