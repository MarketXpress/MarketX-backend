import { Test, TestingModule } from '@nestjs/testing';
import { StellarWebhookProcessor } from './stellar-webhook.processor';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Escrow, EscrowStatus } from '../entities/escrow.entity';
import { Order, OrderStatus, PaymentStatus } from '../entities/order.entity';
import { Transaction, TransactionStatus } from '../entities/transaction.entity';
import { LoggerService } from '../common/logger/logger.service';
import { EventNames } from '../common/events';

describe('StellarWebhookProcessor', () => {
  let processor: StellarWebhookProcessor;
  let eventEmitter: any;

  const mockEscrowRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockEventEmitter = {
    emit: jest.fn(),
  };

  const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  const mockManager = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockDataSource = {
    transaction: jest.fn().mockImplementation((cb) => cb(mockManager)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StellarWebhookProcessor,
        {
          provide: getRepositoryToken(Escrow),
          useValue: mockEscrowRepo,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
        {
          provide: LoggerService,
          useValue: mockLogger,
        },
      ],
    }).compile();

    processor = module.get<StellarWebhookProcessor>(StellarWebhookProcessor);
    eventEmitter = module.get(EventEmitter2);

    jest.clearAllMocks();
    mockManager.findOne.mockReset();
    mockManager.save.mockReset();
  });

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });

  it('should process payment, release escrow, complete transaction, update order, and emit events', async () => {
    const job: any = {
      id: 'job-123',
      data: { transactionHash: 'tx-hash-123' },
    };

    const mockEscrow = {
      id: 'escrow-123',
      transactionHash: 'tx-hash-123',
      status: EscrowStatus.PENDING,
      amount: 100,
    };

    const mockTransaction = {
      id: 'tx-123',
      stellarHash: 'tx-hash-123',
      status: TransactionStatus.PENDING,
      amount: 100,
      currency: 'USD',
      orderId: 'order-123',
    };

    const mockOrder = {
      id: 'order-123',
      buyerId: 'buyer-123',
      status: OrderStatus.PENDING,
      paymentStatus: PaymentStatus.UNPAID,
    };

    // Set up manager findOne responses
    mockManager.findOne.mockImplementation((entity, _options) => {
      if (entity === Escrow) {
        return Promise.resolve(mockEscrow);
      }
      if (entity === Transaction) {
        return Promise.resolve(mockTransaction);
      }
      if (entity === Order) {
        return Promise.resolve(mockOrder);
      }
      return Promise.resolve(null);
    });

    mockManager.save.mockImplementation((entity) => Promise.resolve(entity));

    await processor.handleProcessPayment(job);

    expect(mockEscrow.status).toBe(EscrowStatus.FUNDED);
    expect(mockTransaction.status).toBe(TransactionStatus.COMPLETED);
    expect(mockOrder.status).toBe(OrderStatus.PAID);
    expect(mockOrder.paymentStatus).toBe(PaymentStatus.PAID);

    expect(mockManager.save).toHaveBeenCalledTimes(3); // Escrow, Transaction, Order
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      EventNames.PAYMENT_CONFIRMED,
      expect.any(Object),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      EventNames.ORDER_UPDATED,
      expect.any(Object),
    );
  });

  it('should throw an error if escrow is not found', async () => {
    const job: any = {
      id: 'job-123',
      data: { transactionHash: 'tx-hash-not-found' },
    };

    mockManager.findOne.mockResolvedValue(null);

    await expect(processor.handleProcessPayment(job)).rejects.toThrow(
      'Escrow record not found for transactionHash: tx-hash-not-found',
    );
    expect(mockManager.save).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('should return early if escrow is already released', async () => {
    const job: any = {
      id: 'job-123',
      data: { transactionHash: 'tx-hash-123' },
    };

    const mockEscrow = {
      id: 'escrow-123',
      transactionHash: 'tx-hash-123',
      status: EscrowStatus.FUNDED,
      amount: 100,
    };

    mockManager.findOne.mockResolvedValue(mockEscrow);

    await processor.handleProcessPayment(job);

    expect(mockManager.save).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });
});
