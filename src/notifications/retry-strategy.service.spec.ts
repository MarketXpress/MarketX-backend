import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RetryStrategyService, RetryConfig } from './retry-strategy.service';

describe('RetryStrategyService', () => {
  let service: RetryStrategyService;
  let eventEmitter: EventEmitter2;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RetryStrategyService,
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<RetryStrategyService>(RetryStrategyService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('executeWithRetry', () => {
    it('should succeed on first attempt without retries', async () => {
      const operation = jest.fn().mockResolvedValue('success');

      const result = await service.executeWithRetry(operation);

      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
      expect(result.attempts).toHaveLength(0);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and succeed', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockRejectedValueOnce(new Error('Second failure'))
        .mockResolvedValue('success');

      const result = await service.executeWithRetry(operation, {
        maxRetries: 3,
        initialDelayMs: 10,
        maxDelayMs: 50,
        useJitter: false,
      });

      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
      expect(result.attempts.length).toBeGreaterThan(0);
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should fail after exhausting all retries', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Always fails'));

      const result = await service.executeWithRetry(operation, {
        maxRetries: 2,
        initialDelayMs: 10,
        maxDelayMs: 50,
        useJitter: false,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.attempts.length).toBe(2);
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should emit retry events', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockResolvedValue('success');

      await service.executeWithRetry(operation, {
        maxRetries: 3,
        initialDelayMs: 10,
        maxDelayMs: 50,
        useJitter: false,
      });

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'notification.retry.started',
        expect.any(Object),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'notification.retry.succeeded',
        expect.any(Object),
      );
    });

    it('should emit retry exhausted event when all retries fail', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Always fails'));

      await service.executeWithRetry(operation, {
        maxRetries: 2,
        initialDelayMs: 10,
        maxDelayMs: 50,
        useJitter: false,
      });

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'notification.retry.exhausted',
        expect.any(Object),
      );
    });
  });

  describe('getConfigForNotificationType', () => {
    it('should return email config for email type', () => {
      const config = service.getConfigForNotificationType('email');

      expect(config.maxRetries).toBe(5);
      expect(config.initialDelayMs).toBe(2000);
    });

    it('should return push config for push type', () => {
      const config = service.getConfigForNotificationType('push');

      expect(config.maxRetries).toBe(3);
      expect(config.initialDelayMs).toBe(1000);
    });

    it('should return sms config for sms type', () => {
      const config = service.getConfigForNotificationType('sms');

      expect(config.maxRetries).toBe(4);
      expect(config.initialDelayMs).toBe(3000);
    });

    it('should return default config for unknown type', () => {
      const config = service.getConfigForNotificationType('unknown');

      expect(config.maxRetries).toBe(3);
      expect(config.initialDelayMs).toBe(1000);
    });
  });
});
