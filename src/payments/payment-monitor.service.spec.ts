import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SchedulerRegistry } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';

import { PaymentMonitorService } from './payment-monitor.service';
import { PaymentsService } from './payments.service';
import { Payment } from './entities/payment.entity';
import { PaymentStatus, PaymentCurrency } from './dto/payment.dto';

describe('PaymentMonitorService', () => {
  let service: PaymentMonitorService;
  let mockPaymentsRepo: any;
  let mockPaymentsService: any;
  let mockEventEmitter: any;
  let mockConfigService: any;
  let mockSchedulerRegistry: any;

  const testPaymentId = 'payment-123';
  const testWalletAddress = 'GBUQWP3BOUZX34ULNQG23RQ6F5DOBAB4NSTZDVSXTVWDNXMhtqc6VPM7';

  beforeEach(async () => {
    mockPaymentsRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
    };

    mockPaymentsService = {
      verifyAndConfirmPayment: jest.fn(),
      handlePaymentTimeout: jest.fn(),
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

    mockSchedulerRegistry = {
      addInterval: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentMonitorService,
        {
          provide: getRepositoryToken(Payment),
          useValue: mockPaymentsRepo,
        },
        {
          provide: PaymentsService,
          useValue: mockPaymentsService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
        {
          provide: SchedulerRegistry,
          useValue: mockSchedulerRegistry,
        },
      ],
    }).compile();

    service = module.get<PaymentMonitorService>(PaymentMonitorService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('onModuleInit', () => {
    it('should initialize payment monitoring', async () => {
      mockPaymentsRepo.find.mockResolvedValue([]);

      await service.onModuleInit();

      expect(mockPaymentsRepo.find).toHaveBeenCalled();
    });

    it('should resume monitoring for pending payments', async () => {
      const now = new Date();
      const futureDate = new Date(now.getTime() + 30 * 60 * 1000); // 30 minutes from now

      const mockPayments = [
        {
          id: 'payment-1',
          destinationWalletAddress: testWalletAddress,
          status: PaymentStatus.PENDING,
          expiresAt: futureDate,
        },
      ];

      mockPaymentsRepo.find.mockResolvedValue(mockPayments);

      // Mock Stellar server stream method
      const mockClose = jest.fn();
      const originalServer = (service as any).stellarServer;
      (service as any).stellarServer = {
        transactions: jest.fn().mockReturnValue({
          forAccount: jest.fn().mockReturnValue({
            stream: jest.fn().mockResolvedValue(mockClose),
          }),
        }),
      };

      await service.onModuleInit();

      expect(service.isMonitoring('payment-1')).toBe(true);
    });

    it('should handle expired payments during init', async () => {
      const now = new Date();
      const pastDate = new Date(now.getTime() - 30 * 60 * 1000); // 30 minutes ago

      const mockPayments = [
        {
          id: 'payment-1',
          destinationWalletAddress: testWalletAddress,
          status: PaymentStatus.PENDING,
          expiresAt: pastDate,
        },
      ];

      mockPaymentsRepo.find.mockResolvedValue(mockPayments);
      mockPaymentsService.handlePaymentTimeout.mockResolvedValue({});

      await service.onModuleInit();

      expect(mockPaymentsService.handlePaymentTimeout).toHaveBeenCalledWith('payment-1');
    });
  });

  describe('monitorPayment', () => {
    it('should start monitoring a payment', async () => {
      const mockClose = jest.fn();
      const originalServer = (service as any).stellarServer;
      (service as any).stellarServer = {
        transactions: jest.fn().mockReturnValue({
          forAccount: jest.fn().mockReturnValue({
            stream: jest.fn().mockResolvedValue(mockClose),
          }),
        }),
      };

      await service.monitorPayment(testPaymentId, testWalletAddress);

      expect(service.isMonitoring(testPaymentId)).toBe(true);

      // Cleanup
      service.stopMonitoringPayment(testPaymentId);
    });

    it('should not start monitoring if already monitoring', async () => {
      // Pre-populate active streams
      (service as any).activeStreams.set(testPaymentId, {
        paymentId: testPaymentId,
        destinationAddress: testWalletAddress,
        closeFunction: jest.fn(),
      });

      const mockServer = (service as any).stellarServer;
      const streamSpy = jest.spyOn(mockServer.transactions().forAccount(''), 'stream');

      await service.monitorPayment(testPaymentId, testWalletAddress);

      expect(streamSpy).not.toHaveBeenCalled();
      expect(service.isMonitoring(testPaymentId)).toBe(true);
    });
  });

  describe('stopMonitoringPayment', () => {
    it('should stop monitoring a payment', () => {
      const mockClose = jest.fn();
      (service as any).activeStreams.set(testPaymentId, {
        paymentId: testPaymentId,
        destinationAddress: testWalletAddress,
        closeFunction: mockClose,
      });

      service.stopMonitoringPayment(testPaymentId);

      expect(mockClose).toHaveBeenCalled();
      expect(service.isMonitoring(testPaymentId)).toBe(false);
    });

    it('should handle non-existent payment gracefully', () => {
      expect(() => {
        service.stopMonitoringPayment('non-existent');
      }).not.toThrow();
    });
  });

  describe('checkPaymentOperation', () => {
    it('should identify relevant payment operation', async () => {
      const mockPayment: Partial<Payment> = {
        id: testPaymentId,
        amount: 100,
        currency: PaymentCurrency.XLM,
        destinationWalletAddress: testWalletAddress,
      };

      const operation = {
        type: 'payment',
        to: testWalletAddress,
        destination: testWalletAddress,
        amount: '100',
        asset_code: 'XLM',
      };

      const result = await (service as any).checkPaymentOperation(
        mockPayment,
        operation,
        testWalletAddress,
      );

      expect(result).toBe(true);
    });

    it('should reject operation with different destination', async () => {
      const mockPayment: Partial<Payment> = {
        id: testPaymentId,
        amount: 100,
        currency: PaymentCurrency.XLM,
        destinationWalletAddress: testWalletAddress,
      };

      const operation = {
        type: 'payment',
        to: 'GDIFFERENT',
        amount: '100',
        asset_code: 'XLM',
      };

      const result = await (service as any).checkPaymentOperation(
        mockPayment,
        operation,
        testWalletAddress,
      );

      expect(result).toBe(false);
    });

    it('should reject operation with different amount', async () => {
      const mockPayment: Partial<Payment> = {
        id: testPaymentId,
        amount: 100,
        currency: PaymentCurrency.XLM,
        destinationWalletAddress: testWalletAddress,
      };

      const operation = {
        type: 'payment',
        to: testWalletAddress,
        amount: '99.99',
        asset_code: 'XLM',
      };

      const result = await (service as any).checkPaymentOperation(
        mockPayment,
        operation,
        testWalletAddress,
      );

      expect(result).toBe(false);
    });

    it('should reject operation with different asset', async () => {
      const mockPayment: Partial<Payment> = {
        id: testPaymentId,
        amount: 100,
        currency: PaymentCurrency.USDC,
        destinationWalletAddress: testWalletAddress,
      };

      const operation = {
        type: 'payment',
        to: testWalletAddress,
        amount: '100',
        asset_code: 'XLM',
      };

      const result = await (service as any).checkPaymentOperation(
        mockPayment,
        operation,
        testWalletAddress,
      );

      expect(result).toBe(false);
    });
  });

  describe('getActiveStreamCount', () => {
    it('should return count of active streams', () => {
      (service as any).activeStreams.set('payment-1', { paymentId: 'payment-1' });
      (service as any).activeStreams.set('payment-2', { paymentId: 'payment-2' });

      expect(service.getActiveStreamCount()).toBe(2);
    });

    it('should return 0 when no streams active', () => {
      (service as any).activeStreams.clear();
      expect(service.getActiveStreamCount()).toBe(0);
    });
  });

  describe('onModuleDestroy', () => {
    it('should clean up all streams and timeouts', async () => {
      const mockClose1 = jest.fn();
      const mockClose2 = jest.fn();

      (service as any).activeStreams.set('payment-1', {
        paymentId: 'payment-1',
        closeFunction: mockClose1,
      });
      (service as any).activeStreams.set('payment-2', {
        paymentId: 'payment-2',
        closeFunction: mockClose2,
      });

      (service as any).timeoutIntervals.set('payment-1', setTimeout(() => {}, 1000));
      (service as any).timeoutIntervals.set('payment-2', setTimeout(() => {}, 1000));

      await service.onModuleDestroy();

      expect(mockClose1).toHaveBeenCalled();
      expect(mockClose2).toHaveBeenCalled();
      expect(service.getActiveStreamCount()).toBe(0);
    });
  });
});
