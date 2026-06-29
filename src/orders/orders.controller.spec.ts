import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrdersExportService } from './orders-export.service';
import { IdempotencyService } from '../common/idempotency/idempotency.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { Order, OrderStatus, PaymentStatus } from './entities/order.entity';
import { SupportedCurrency } from '../products/services/pricing.service';

describe('OrdersController', () => {
  let controller: OrdersController;
  let ordersService: any;
  let eventEmitter: any;
  let idempotencyService: any;
  let cache: { get: any; set: any };

  const buildOrder = (id: string): Order =>
    ({
      id,
      buyerId: 'buyer-1',
      currency: SupportedCurrency.USD,
      status: OrderStatus.PENDING,
      paymentStatus: PaymentStatus.UNPAID,
      totalAmount: 100,
      releasedAmount: 0,
      remainingAmount: 100,
      items: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }) as unknown as Order;

  const sampleDto: CreateOrderDto = {
    buyerId: 'buyer-1',
    items: [{ productId: 'p-1', quantity: 1 }],
  };

  beforeEach(async () => {
    cache = {
      get: jest.fn().mockResolvedValue(undefined),
      set: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [
        {
          provide: OrdersService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            updateStatus: jest.fn(),
            cancelOrder: jest.fn(),
          },
        },
        {
          provide: OrdersExportService,
          useValue: {
            exportAsCsv: jest.fn(),
            exportAsPdf: jest.fn(),
          },
        },
        {
          provide: EventEmitter2,
          useValue: { emit: jest.fn() },
        },
        {
          provide: IdempotencyService,
          useValue: { executeOnce: jest.fn() },
        },
        {
          provide: CACHE_MANAGER,
          useValue: cache,
        },
      ],
    }).compile();

    controller = module.get<OrdersController>(OrdersController);
    ordersService = module.get(OrdersService);
    eventEmitter = module.get(EventEmitter2);
    idempotencyService = module.get(IdempotencyService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('creates and emits an OrderCreatedEvent when no Idempotency-Key is provided', async () => {
      const order = buildOrder('order-1');
      ordersService.create.mockResolvedValue(order);

      const result = await controller.create(sampleDto, undefined);

      expect(result).toBe(order);
      expect(ordersService.create).toHaveBeenCalledTimes(1);
      expect(ordersService.create).toHaveBeenCalledWith(sampleDto);
      expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'order.created',
        expect.objectContaining({ orderId: 'order-1' }),
      );
      expect(idempotencyService.executeOnce).not.toHaveBeenCalled();
      expect(cache.get).not.toHaveBeenCalled();
      expect(cache.set).not.toHaveBeenCalled();
    });

    it('executes OrdersService.create only once when the same Idempotency-Key is reused', async () => {
      const order = buildOrder('order-1');
      ordersService.create.mockResolvedValue(order);

      // Replay the exact cached-response path: first call writes the
      // response to cache, second call hits the cached short-circuit.
      cache.get
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(order);

      idempotencyService.executeOnce
        .mockImplementationOnce(
          async (_key: string, op: () => Promise<unknown>) => {
            const result = await op();
            return { executed: true, result };
          },
        )
        .mockResolvedValueOnce({ executed: false });

      const first = await controller.create(sampleDto, 'idem-1');
      const second = await controller.create(sampleDto, 'idem-1');

      expect(first).toBe(order);
      expect(second).toBe(order);
      expect(ordersService.create).toHaveBeenCalledTimes(1);
      expect(idempotencyService.executeOnce).toHaveBeenCalledTimes(2);
      expect(idempotencyService.executeOnce).toHaveBeenNthCalledWith(
        1,
        'idem-1',
        expect.any(Function),
      );
      expect(cache.set).toHaveBeenCalledTimes(1);
    });

    it('returns the cached response without invoking OrdersService when the response is already cached', async () => {
      const order = buildOrder('order-99');
      cache.get.mockResolvedValueOnce(order);

      const result = await controller.create(sampleDto, 'idem-cached');

      expect(result).toBe(order);
      expect(ordersService.create).not.toHaveBeenCalled();
      expect(idempotencyService.executeOnce).not.toHaveBeenCalled();
    });

    it('creates separate orders when different Idempotency-Keys are used', async () => {
      const order1 = buildOrder('order-1');
      const order2 = buildOrder('order-2');
      ordersService.create
        .mockResolvedValueOnce(order1)
        .mockResolvedValueOnce(order2);

      cache.get.mockResolvedValue(undefined);
      idempotencyService.executeOnce.mockImplementation(
        async (_key: string, op: () => Promise<unknown>) => {
          const result = await op();
          return { executed: true, result };
        },
      );

      const first = await controller.create(sampleDto, 'idem-A');
      const second = await controller.create(sampleDto, 'idem-B');

      expect(first).toBe(order1);
      expect(second).toBe(order2);
      expect(first).not.toBe(second);
      expect(ordersService.create).toHaveBeenCalledTimes(2);
      expect(idempotencyService.executeOnce).toHaveBeenCalledTimes(2);
      expect(idempotencyService.executeOnce).toHaveBeenCalledWith(
        'idem-A',
        expect.any(Function),
      );
      expect(idempotencyService.executeOnce).toHaveBeenCalledWith(
        'idem-B',
        expect.any(Function),
      );
    });
  });
});
