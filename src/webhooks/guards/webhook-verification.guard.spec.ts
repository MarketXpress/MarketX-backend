import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { WebhookVerificationGuard } from './webhook-verification.guard';
import { WebhooksMetricsService } from '../services/webhooks-metrics.service';
import { RedisCacheService } from '../../redis-caching/redis-cache.service';
import { WEBHOOK_VERIFIED_OPTIONS } from '../constants/webhook.constants';
import { WebhookVerifiedOptions } from '../decorators/webhook-verified.decorator';

describe('WebhookVerificationGuard', () => {
  let guard: WebhookVerificationGuard;
  let reflector: Reflector;
  let configService: ConfigService;
  let redisCache: RedisCacheService;
  let metricsService: WebhooksMetricsService;

  const mockReflector = {
    get: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockRedisCache = {
    get: jest.fn(),
    set: jest.fn(),
  };

  const mockMetricsService = {
    recordVerification: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookVerificationGuard,
        {
          provide: Reflector,
          useValue: mockReflector,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: RedisCacheService,
          useValue: mockRedisCache,
        },
        {
          provide: WebhooksMetricsService,
          useValue: mockMetricsService,
        },
      ],
    }).compile();

    guard = module.get<WebhookVerificationGuard>(WebhookVerificationGuard);
    reflector = module.get<Reflector>(Reflector);
    configService = module.get<ConfigService>(ConfigService);
    redisCache = module.get<RedisCacheService>(RedisCacheService);
    metricsService = module.get<WebhooksMetricsService>(WebhooksMetricsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const createMockContext = (headers: Record<string, string>, body: any) => {
    const mockRequest = {
      headers,
      body,
      url: '/webhook/test',
      ip: '127.0.0.1',
      get: (key: string) => headers[key.toLowerCase()],
    };

    return {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    } as ExecutionContext;
  };

  describe('canActivate', () => {
    const defaultOptions: WebhookVerifiedOptions = {
      provider: 'generic',
      signatureHeader: 'X-Webhook-Signature',
      timestampHeader: 'X-Webhook-Timestamp',
      nonceHeader: 'X-Webhook-Nonce',
      timestampToleranceMs: 300000,
    };

    it('should allow access when no webhook verification options are set', async () => {
      mockReflector.get.mockReturnValue(null);

      const context = createMockContext({}, {});
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockMetricsService.recordVerification).not.toHaveBeenCalled();
    });

    it('should verify webhook successfully with valid signature, timestamp, and nonce', async () => {
      mockReflector.get.mockReturnValue(defaultOptions);
      mockConfigService.get.mockReturnValue('test-secret');
      mockRedisCache.get.mockResolvedValue(null);

      const timestamp = Date.now().toString();
      const nonce = 'unique-nonce';
      const payload = { test: 'data' };
      const signature = 'valid-signature';

      const headers = {
        'x-webhook-signature': signature,
        'x-webhook-timestamp': timestamp,
        'x-webhook-nonce': nonce,
      };

      const context = createMockContext(headers, payload);
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockRedisCache.get).toHaveBeenCalledWith('webhook_nonce:unique-nonce');
      expect(mockRedisCache.set).toHaveBeenCalledWith('webhook_nonce:unique-nonce', '1', 86400);
      expect(mockMetricsService.recordVerification).toHaveBeenCalledWith(true, expect.any(Number));
    });

    it('should reject webhook with missing signature', async () => {
      mockReflector.get.mockReturnValue(defaultOptions);

      const headers = {
        'x-webhook-timestamp': Date.now().toString(),
        'x-webhook-nonce': 'unique-nonce',
      };

      const context = createMockContext(headers, {});

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
      expect(mockMetricsService.recordVerification).toHaveBeenCalledWith(false, expect.any(Number));
    });

    it('should reject webhook with missing timestamp', async () => {
      mockReflector.get.mockReturnValue(defaultOptions);

      const headers = {
        'x-webhook-signature': 'valid-signature',
        'x-webhook-nonce': 'unique-nonce',
      };

      const context = createMockContext(headers, {});

      await expect(guard.canActivate(context)).rejects.toThrow(BadRequestException);
      expect(mockMetricsService.recordVerification).toHaveBeenCalledWith(false, expect.any(Number));
    });

    it('should reject webhook with missing nonce', async () => {
      mockReflector.get.mockReturnValue(defaultOptions);

      const headers = {
        'x-webhook-signature': 'valid-signature',
        'x-webhook-timestamp': Date.now().toString(),
      };

      const context = createMockContext(headers, {});

      await expect(guard.canActivate(context)).rejects.toThrow(BadRequestException);
      expect(mockMetricsService.recordVerification).toHaveBeenCalledWith(false, expect.any(Number));
    });

    it('should reject webhook with replayed nonce', async () => {
      mockReflector.get.mockReturnValue(defaultOptions);
      mockRedisCache.get.mockResolvedValue('1'); // Nonce already exists

      const headers = {
        'x-webhook-signature': 'valid-signature',
        'x-webhook-timestamp': Date.now().toString(),
        'x-webhook-nonce': 'reused-nonce',
      };

      const context = createMockContext(headers, {});

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
      expect(mockMetricsService.recordVerification).toHaveBeenCalledWith(false, expect.any(Number));
    });

    it('should reject webhook with timestamp outside tolerance window', async () => {
      mockReflector.get.mockReturnValue(defaultOptions);
      mockRedisCache.get.mockResolvedValue(null);

      const oldTimestamp = (Date.now() - 400000).toString(); // 6+ minutes ago
      const headers = {
        'x-webhook-signature': 'valid-signature',
        'x-webhook-timestamp': oldTimestamp,
        'x-webhook-nonce': 'unique-nonce',
      };

      const context = createMockContext(headers, {});

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
      expect(mockMetricsService.recordVerification).toHaveBeenCalledWith(false, expect.any(Number));
    });

    it('should handle Stripe webhook signature format', async () => {
      const stripeOptions: WebhookVerifiedOptions = {
        provider: 'stripe',
        signatureHeader: 'Stripe-Signature',
        timestampHeader: 'Stripe-Timestamp',
        nonceHeader: 'Stripe-Nonce',
        timestampToleranceMs: 300000,
      };

      mockReflector.get.mockReturnValue(stripeOptions);
      mockConfigService.get.mockReturnValue('stripe-secret');
      mockRedisCache.get.mockResolvedValue(null);

      const headers = {
        'stripe-signature': 't=1234567890,v1=signature',
        'stripe-timestamp': Date.now().toString(),
        'stripe-nonce': 'unique-nonce',
      };

      const context = createMockContext(headers, {});
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockMetricsService.recordVerification).toHaveBeenCalledWith(true, expect.any(Number));
    });
  });
});
