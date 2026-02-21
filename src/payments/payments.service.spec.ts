import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';

import { PaymentsService } from './payments.service';
import { Payment } from './entities/payment.entity';
import { Order } from '../orders/entities/order.entity';
import { Wallet } from '../wallet/entities/wallet.entity';
import { PaymentStatus, PaymentCurrency } from './dto/payment.dto';
import { OrderStatus } from '../orders/dto/create-order.dto';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let mockPaymentsRepo: any;
  let mockOrdersRepo: any;
  let mockWalletsRepo: any;
  let mockEventEmitter: any;
  let mockConfigService: any;

  const testOrderId = 'order-123';
  const testBuyerId = 'buyer-123';
  const testWalletAddress = 'GBUQWP3BOUZX34ULNQG23RQ6F5DOBAB4NSTZDVSXTVWDNXMhtqc6VPM7';

  beforeEach(async () => {
    // Mock repositories
    mockPaymentsRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
    };

    mockOrdersRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
    };

    mockWalletsRepo = {
      findOne: jest.fn(),
    };

    mockEventEmitter = {
      emit: jest.fn(),
    };

    mockConfigService = {
      get: jest.fn((key, defaultValue) => {
        if (key === 'STELLAR_HORIZON_URL') {
          return 'https://horizon-testnet.stellar.org';
        }
        if (key === 'STELLAR_NETWORK_PASSPHRASE') {
          return 'Test SDF Network ; September 2015';
        }
        return defaultValue;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        {
          provide: getRepositoryToken(Payment),
          useValue: mockPaymentsRepo,
        },
        {
          provide: getRepositoryToken(Order),
          useValue: mockOrdersRepo,
        },
        {
          provide: getRepositoryToken(Wallet),
          useValue: mockWalletsRepo,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initiatePayment', () => {
    it('should create a pending payment for a valid order', async () => {
      const mockOrder: Partial<Order> = {
        id: testOrderId,
        totalAmount: 100,
        status: OrderStatus.PENDING,
        buyerId: testBuyerId,
      };

      const mockWallet: Partial<Wallet> = {
        publicKey: testWalletAddress,
      };

      const mockPayment: Partial<Payment> = {
        id: 'payment-123',
        orderId: testOrderId,
        amount: 100,
        currency: PaymentCurrency.XLM,
        status: PaymentStatus.PENDING,
        destinationWalletAddress: testWalletAddress,
        buyerId: testBuyerId,
      };

      mockOrdersRepo.findOne.mockResolvedValue(mockOrder);
      mockWalletsRepo.findOne.mockResolvedValue(mockWallet);
      mockPaymentsRepo.create.mockReturnValue(mockPayment);
      mockPaymentsRepo.save.mockResolvedValue(mockPayment);

      const result = await service.initiatePayment({
        orderId: testOrderId,
        currency: PaymentCurrency.XLM,
        timeoutMinutes: 30,
      });

      expect(result).toEqual({
        id: 'payment-123',
        orderId: testOrderId,
        amount: 100,
        currency: PaymentCurrency.XLM,
        status: PaymentStatus.PENDING,
        destinationWalletAddress: testWalletAddress,
        sourceWalletAddress: undefined,
        confirmationCount: 0,
        createdAt: undefined,
        confirmedAt: undefined,
        expiresAt: undefined,
      });

      expect(mockPaymentsRepo.save).toHaveBeenCalledTimes(1);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('payment.initiated', expect.any(Object));
    });

    it('should throw error if order not found', async () => {
      mockOrdersRepo.findOne.mockResolvedValue(null);

      await expect(
        service.initiatePayment({
          orderId: 'non-existent',
          currency: PaymentCurrency.XLM,
        }),
      ).rejects.toThrow('Order with ID');
    });

    it('should throw error if order is not in PENDING status', async () => {
      const mockOrder: Partial<Order> = {
        id: testOrderId,
        status: OrderStatus.PAID,
        buyerId: testBuyerId,
      };

      mockOrdersRepo.findOne.mockResolvedValue(mockOrder);

      await expect(
        service.initiatePayment({
          orderId: testOrderId,
          currency: PaymentCurrency.XLM,
        }),
      ).rejects.toThrow('Order must be in PENDING status');
    });

    it('should throw error if wallet not found', async () => {
      const mockOrder: Partial<Order> = {
        id: testOrderId,
        status: OrderStatus.PENDING,
        buyerId: testBuyerId,
      };

      mockOrdersRepo.findOne.mockResolvedValue(mockOrder);
      mockWalletsRepo.findOne.mockResolvedValue(null);

      await expect(
        service.initiatePayment({
          orderId: testOrderId,
          currency: PaymentCurrency.XLM,
        }),
      ).rejects.toThrow('Wallet not found');
    });

    it('should return existing pending payment if one exists', async () => {
      const mockOrder: Partial<Order> = {
        id: testOrderId,
        status: OrderStatus.PENDING,
        buyerId: testBuyerId,
      };

      const existingPayment: Partial<Payment> = {
        id: 'payment-123',
        orderId: testOrderId,
        status: PaymentStatus.PENDING,
        amount: 100,
        currency: PaymentCurrency.XLM,
        destinationWalletAddress: testWalletAddress,
        buyerId: testBuyerId,
      };

      mockOrdersRepo.findOne.mockResolvedValue(mockOrder);
      mockPaymentsRepo.findOne.mockResolvedValue(existingPayment);

      const result = await service.initiatePayment({
        orderId: testOrderId,
        currency: PaymentCurrency.XLM,
      });

      expect(result.id).toBe('payment-123');
      expect(mockPaymentsRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('verifyAndConfirmPayment', () => {
    it('should confirm payment with valid transaction', async () => {
      const mockPayment: Partial<Payment> = {
        id: 'payment-123',
        orderId: testOrderId,
        amount: 100,
        currency: PaymentCurrency.XLM,
        status: PaymentStatus.PENDING,
        destinationWalletAddress: testWalletAddress,
        timeoutMinutes: 30,
        buyerId: testBuyerId,
      };

      const mockOrder: Partial<Order> = {
        id: testOrderId,
        status: OrderStatus.PENDING,
        buyerId: testBuyerId,
      };

      mockPaymentsRepo.findOne.mockResolvedValue({ ...mockPayment, order: mockOrder });
      mockPaymentsRepo.save.mockResolvedValue({
        ...mockPayment,
        status: PaymentStatus.CONFIRMED,
        stellarTransactionId: 'tx-123',
        confirmedAt: new Date(),
      });
      mockOrdersRepo.save.mockResolvedValue({ ...mockOrder, status: OrderStatus.PAID });

      const transactionData = {
        id: 'tx-123',
        source_account: 'GBUQWP3BOUZX34ULNQG23RQ6F5DOBAB4NSTZDVSXTVWDNXMHTQC6VTEST',
        to: testWalletAddress,
        destination: testWalletAddress,
        amount: '100',
        asset_code: 'XLM',
        created_at: new Date().toISOString(),
        confirmations: 1,
      };

      const result = await service.verifyAndConfirmPayment('payment-123', transactionData);

      expect(result.status).toBe(PaymentStatus.CONFIRMED);
      expect(result.stellarTransactionId).toBe('tx-123');
      expect(mockOrdersRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: OrderStatus.PAID }),
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('payment.confirmed', expect.any(Object));
    });

    it('should fail payment if destination does not match', async () => {
      const mockPayment: Partial<Payment> = {
        id: 'payment-123',
        orderId: testOrderId,
        amount: 100,
        status: PaymentStatus.PENDING,
        destinationWalletAddress: testWalletAddress,
        timeoutMinutes: 30,
        buyerId: testBuyerId,
      };

      mockPaymentsRepo.findOne.mockResolvedValue(mockPayment);
      mockPaymentsRepo.save.mockResolvedValue({
        ...mockPayment,
        status: PaymentStatus.FAILED,
      });

      const transactionData = {
        id: 'tx-123',
        to: 'GDIFFERENT',
        amount: '100',
        created_at: new Date().toISOString(),
      };

      const result = await service.verifyAndConfirmPayment('payment-123', transactionData);

      expect(result.status).toBe(PaymentStatus.FAILED);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('payment.failed', expect.any(Object));
    });

    it('should fail payment if amount does not match', async () => {
      const mockPayment: Partial<Payment> = {
        id: 'payment-123',
        orderId: testOrderId,
        amount: 100,
        status: PaymentStatus.PENDING,
        destinationWalletAddress: testWalletAddress,
        timeoutMinutes: 30,
        buyerId: testBuyerId,
      };

      mockPaymentsRepo.findOne.mockResolvedValue(mockPayment);
      mockPaymentsRepo.save.mockResolvedValue({
        ...mockPayment,
        status: PaymentStatus.FAILED,
      });

      const transactionData = {
        id: 'tx-123',
        to: testWalletAddress,
        amount: '99.99',
        created_at: new Date().toISOString(),
      };

      const result = await service.verifyAndConfirmPayment('payment-123', transactionData);

      expect(result.status).toBe(PaymentStatus.FAILED);
    });

    it('should fail payment if currency does not match', async () => {
      const mockPayment: Partial<Payment> = {
        id: 'payment-123',
        orderId: testOrderId,
        amount: 100,
        currency: PaymentCurrency.USDC,
        status: PaymentStatus.PENDING,
        destinationWalletAddress: testWalletAddress,
        timeoutMinutes: 30,
        buyerId: testBuyerId,
      };

      mockPaymentsRepo.findOne.mockResolvedValue(mockPayment);
      mockPaymentsRepo.save.mockResolvedValue({
        ...mockPayment,
        status: PaymentStatus.FAILED,
      });

      const transactionData = {
        id: 'tx-123',
        to: testWalletAddress,
        amount: '100',
        asset_code: 'XLM',
        created_at: new Date().toISOString(),
      };

      const result = await service.verifyAndConfirmPayment('payment-123', transactionData);

      expect(result.status).toBe(PaymentStatus.FAILED);
    });
  });

  describe('handlePaymentTimeout', () => {
    it('should mark payment as timeout', async () => {
      const mockPayment: Partial<Payment> = {
        id: 'payment-123',
        orderId: testOrderId,
        status: PaymentStatus.PENDING,
        buyerId: testBuyerId,
      };

      mockPaymentsRepo.findOne.mockResolvedValue(mockPayment);
      mockPaymentsRepo.save.mockResolvedValue({
        ...mockPayment,
        status: PaymentStatus.TIMEOUT,
      });

      const result = await service.handlePaymentTimeout('payment-123');

      expect(result.status).toBe(PaymentStatus.TIMEOUT);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('payment.timeout', expect.any(Object));
    });

    it('should throw error if payment not found', async () => {
      mockPaymentsRepo.findOne.mockResolvedValue(null);

      await expect(service.handlePaymentTimeout('non-existent')).rejects.toThrow(
        'Payment with ID',
      );
    });
  });

  describe('getPaymentById', () => {
    it('should return payment details', async () => {
      const mockPayment: Partial<Payment> = {
        id: 'payment-123',
        orderId: testOrderId,
        amount: 100,
        currency: PaymentCurrency.XLM,
        status: PaymentStatus.PENDING,
        destinationWalletAddress: testWalletAddress,
        buyerId: testBuyerId,
      };

      mockPaymentsRepo.findOne.mockResolvedValue(mockPayment);

      const result = await service.getPaymentById('payment-123');

      expect(result.id).toBe('payment-123');
      expect(result.status).toBe(PaymentStatus.PENDING);
    });

    it('should throw error if payment not found', async () => {
      mockPaymentsRepo.findOne.mockResolvedValue(null);

      await expect(service.getPaymentById('non-existent')).rejects.toThrow(
        'Payment with ID',
      );
    });
  });

  describe('getPaymentStats', () => {
    it('should return payment statistics', async () => {
      const mockPayments = [
        {
          id: 'payment-1',
          status: PaymentStatus.CONFIRMED,
          amount: 100,
          buyerId: testBuyerId,
        },
        {
          id: 'payment-2',
          status: PaymentStatus.CONFIRMED,
          amount: 50,
          buyerId: testBuyerId,
        },
        {
          id: 'payment-3',
          status: PaymentStatus.PENDING,
          amount: 75,
          buyerId: testBuyerId,
        },
        {
          id: 'payment-4',
          status: PaymentStatus.FAILED,
          amount: 25,
          buyerId: testBuyerId,
        },
      ];

      mockPaymentsRepo.find.mockResolvedValue(mockPayments);

      const stats = await service.getPaymentStats(testBuyerId);

      expect(stats.totalPayments).toBe(4);
      expect(stats.confirmedCount).toBe(2);
      expect(stats.pendingCount).toBe(1);
      expect(stats.failedCount).toBe(1);
      expect(stats.totalConfirmedAmount).toBe(150);
    });
  });
});
