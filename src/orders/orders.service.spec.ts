import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
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
const BUYER_ID = 'buyer-uuid';
const SELLER_ID = 'seller-uuid';
const actingBuyer = { id: BUYER_ID, role: 'buyer' };
const actingSeller = { id: SELLER_ID, role: 'seller' };
const actingAdmin = { id: 'admin-uuid', role: 'admin' };
const actingStranger = { id: 'stranger-uuid', role: 'buyer' };

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: ORDER_ID,
    buyerId: BUYER_ID,
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
  };
}

function makeProduct(
  overrides: Partial<{ price: string; currency: SupportedCurrency }> = {},
) {
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
    transaction: jest
      .fn()
      .mockImplementation((cb: (m: typeof manager) => unknown) => cb(manager)),
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
  let logger: {
    info: jest.Mock;
    error: jest.Mock;
    warn: jest.Mock;
    debug: jest.Mock;
  };

  beforeEach(() => {
    ordersRepo = makeOrdersRepo();
    manager = makeManager();
    dataSource = makeDataSource(manager);
    productsService = { findOne: jest.fn() };
    eventEmitter = { emit: jest.fn() };
    logger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

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
      });

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
      productsService.findOne.mockReturnValue(
        makeProduct({ currency: SupportedCurrency.EUR }),
      );
      const order = makeOrder({ currency: SupportedCurrency.EUR });
      manager.create.mockReturnValue(order);
      manager.save.mockResolvedValue(order);

      await service.create({
        buyerId: 'buyer-uuid',
        items: [{ productId: 'product-uuid', quantity: 1 }],
        paymentCurrency: SupportedCurrency.EUR,
      });

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

  // ── findOne() — ownership check (#466) ──────────────────────────────────

  describe('findOne()', () => {
    it('returns the order when the caller is the buyer', async () => {
      const order = makeOrder();
      ordersRepo.findOne.mockResolvedValue(order);

      const result = await service.findOne(ORDER_ID, actingBuyer);

      expect(result).toEqual(order);
    });

    it('returns the order when the caller is the seller', async () => {
      const order = makeOrder({ sellerId: SELLER_ID });
      ordersRepo.findOne.mockResolvedValue(order);

      const result = await service.findOne(ORDER_ID, actingSeller);

      expect(result).toEqual(order);
    });

    it('returns the order when the caller is an admin', async () => {
      const order = makeOrder();
      ordersRepo.findOne.mockResolvedValue(order);

      const result = await service.findOne(ORDER_ID, actingAdmin);

      expect(result).toEqual(order);
    });

    it('throws ForbiddenException when the caller is neither buyer, seller, nor admin', async () => {
      const order = makeOrder();
      ordersRepo.findOne.mockResolvedValue(order);

      await expect(service.findOne(ORDER_ID, actingStranger)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws NotFoundException when the order does not exist', async () => {
      ordersRepo.findOne.mockResolvedValue(null);

      await expect(
        service.findOne('non-existent', actingBuyer),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── updateStatus() ────────────────────────────────────────────────────────

  describe('updateStatus()', () => {
    function seedOrder(status: OrderStatus, overrides: Partial<Order> = {}) {
      const order = makeOrder({ status, ...overrides });
      ordersRepo.findOne.mockResolvedValue(order);
      // Return the mutated object so callers can inspect field changes
      ordersRepo.save.mockImplementation((o: Order) => Promise.resolve(o));
      return order;
    }

    it('returns the saved order on a valid transition (PENDING → CONFIRMED)', async () => {
      seedOrder(OrderStatus.PENDING);

      const result = await service.updateStatus(
        ORDER_ID,
        {
          status: OrderStatus.CONFIRMED,
        },
        actingBuyer,
      );

      expect(result.status).toBe(OrderStatus.CONFIRMED);
      expect(ordersRepo.save).toHaveBeenCalled();
    });

    it('throws BadRequestException for an invalid transition (PENDING → COMPLETED)', async () => {
      seedOrder(OrderStatus.PENDING);

      await expect(
        service.updateStatus(
          ORDER_ID,
          { status: OrderStatus.COMPLETED },
          actingBuyer,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(ordersRepo.save).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when moving out of a terminal CANCELLED state', async () => {
      seedOrder(OrderStatus.CANCELLED);

      await expect(
        service.updateStatus(
          ORDER_ID,
          { status: OrderStatus.PENDING },
          actingBuyer,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when moving out of a terminal REFUNDED state', async () => {
      seedOrder(OrderStatus.REFUNDED);

      await expect(
        service.updateStatus(
          ORDER_ID,
          { status: OrderStatus.PENDING },
          actingBuyer,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when the order does not exist', async () => {
      ordersRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateStatus(
          'no-such-id',
          { status: OrderStatus.CONFIRMED },
          actingBuyer,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('sets paymentStatus=PAID and confirmedAt when transitioning to PAID', async () => {
      seedOrder(OrderStatus.PROCESSING);

      const result = await service.updateStatus(
        ORDER_ID,
        {
          status: OrderStatus.PAID,
        },
        actingBuyer,
      );

      expect(result.paymentStatus).toBe(PaymentStatus.PAID);
      expect(result.confirmedAt).toBeInstanceOf(Date);
    });

    it('sets cancelledAt when transitioning to CANCELLED', async () => {
      seedOrder(OrderStatus.PENDING);

      const result = await service.updateStatus(
        ORDER_ID,
        {
          status: OrderStatus.CANCELLED,
        },
        actingBuyer,
      );

      expect(result.cancelledAt).toBeInstanceOf(Date);
    });

    it('sets shippedAt when transitioning to SHIPPED', async () => {
      seedOrder(OrderStatus.PAID);

      const result = await service.updateStatus(
        ORDER_ID,
        {
          status: OrderStatus.SHIPPED,
        },
        actingBuyer,
      );

      expect(result.shippedAt).toBeInstanceOf(Date);
    });

    it('sets deliveredAt when transitioning to DELIVERED', async () => {
      seedOrder(OrderStatus.SHIPPED);

      const result = await service.updateStatus(
        ORDER_ID,
        {
          status: OrderStatus.DELIVERED,
        },
        actingBuyer,
      );

      expect(result.deliveredAt).toBeInstanceOf(Date);
    });

    // ── ownership/role check (#466) ─────────────────────────────────────────

    it('allows the seller to update status', async () => {
      seedOrder(OrderStatus.PENDING, { sellerId: SELLER_ID });

      await expect(
        service.updateStatus(
          ORDER_ID,
          { status: OrderStatus.CONFIRMED },
          actingSeller,
        ),
      ).resolves.not.toThrow();
    });

    it('allows an admin to update status for any order', async () => {
      seedOrder(OrderStatus.PENDING);

      await expect(
        service.updateStatus(
          ORDER_ID,
          { status: OrderStatus.CONFIRMED },
          actingAdmin,
        ),
      ).resolves.not.toThrow();
    });

    it('throws ForbiddenException when a caller who is neither buyer, seller, nor admin tries to update status', async () => {
      seedOrder(OrderStatus.PENDING);

      await expect(
        service.updateStatus(
          ORDER_ID,
          { status: OrderStatus.CONFIRMED },
          actingStranger,
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(ordersRepo.save).not.toHaveBeenCalled();
    });
  });

  // ── cancelOrder() — IDOR regression coverage (#466) ─────────────────────

  describe('cancelOrder()', () => {
    it('cancels a PENDING order for the owning buyer', async () => {
      const order = makeOrder({ status: OrderStatus.PENDING });
      manager.findOne.mockResolvedValue(order);
      manager.save.mockResolvedValue({
        ...order,
        status: OrderStatus.CANCELLED,
      });

      const result = await service.cancelOrder(ORDER_ID, BUYER_ID);

      expect(result.status).toBe(OrderStatus.CANCELLED);
    });

    it('rejects cancellation attempted with a different buyer id than the order owner', async () => {
      // Simulates the fixed controller behavior: the id passed in now always
      // comes from req.user.id, never a client-supplied body field. A caller
      // impersonating another buyer must still be rejected here.
      const order = makeOrder({ buyerId: BUYER_ID });
      manager.findOne.mockResolvedValue(order);

      await expect(
        service.cancelOrder(ORDER_ID, actingStranger.id),
      ).rejects.toThrow('Order not found or unauthorized');
    });
  });

  // ── EventEmitter2.emit ────────────────────────────────────────────────────

  describe('EventEmitter2.emit', () => {
    function seedOrder(status: OrderStatus) {
      const order = makeOrder({ status });
      ordersRepo.findOne.mockResolvedValue(order);
      ordersRepo.save.mockImplementation((o: Order) => Promise.resolve(o));
      return order;
    }

    it('emits ORDER_UPDATED with the correct event name after any status change', async () => {
      const order = seedOrder(OrderStatus.PENDING);

      await service.updateStatus(
        ORDER_ID,
        { status: OrderStatus.CONFIRMED },
        actingBuyer,
      );

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

      await service.updateStatus(
        ORDER_ID,
        { status: OrderStatus.COMPLETED },
        actingBuyer,
      );

      const emittedNames = eventEmitter.emit.mock.calls.map(
        ([name]: [string]) => name,
      );
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

      await service.updateStatus(
        ORDER_ID,
        { status: OrderStatus.CONFIRMED },
        actingBuyer,
      );

      const emittedNames = eventEmitter.emit.mock.calls.map(
        ([name]: [string]) => name,
      );
      expect(emittedNames).not.toContain(EventNames.ORDER_COMPLETED);
    });

    it('emits exactly once for a regular status change (no extra ORDER_COMPLETED)', async () => {
      seedOrder(OrderStatus.CONFIRMED);

      await service.updateStatus(
        ORDER_ID,
        { status: OrderStatus.PROCESSING },
        actingBuyer,
      );

      expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        EventNames.ORDER_UPDATED,
        expect.any(OrderUpdatedEvent),
      );
    });

    it('emits exactly twice when transitioning to COMPLETED', async () => {
      seedOrder(OrderStatus.DELIVERED);

      await service.updateStatus(
        ORDER_ID,
        { status: OrderStatus.COMPLETED },
        actingBuyer,
      );

      expect(eventEmitter.emit).toHaveBeenCalledTimes(2);
    });
  });
});
