import { Test, TestingModule } from '@nestjs/testing';
import {
  StellarWebhookController,
  StellarWebhookDto,
} from './stellar-webhook.controller';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../common/logger/logger.service';
import { getQueueToken } from '@nestjs/bull';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import * as crypto from 'crypto';

describe('StellarWebhookController', () => {
  let controller: StellarWebhookController;
  let queue: any;
  let logger: any;
  let cacheStore: Map<string, string>;

  const mockQueue = {
    add: jest.fn().mockResolvedValue({ id: 'job-id' }),
  };

  const mockConfigService = {
    get: jest.fn().mockImplementation((key: string) => {
      if (key === 'STELLAR_WEBHOOK_SECRET') {
        return 'test-secret';
      }
      return null;
    }),
  };

  const mockCache = {
    get: jest.fn((key: string) => Promise.resolve(cacheStore.get(key))),
    set: jest.fn((key: string, value: string) => {
      cacheStore.set(key, value);
      return Promise.resolve();
    }),
  };

  const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  const signBody = (body: StellarWebhookDto) =>
    crypto
      .createHmac('sha256', 'test-secret')
      .update(JSON.stringify(body))
      .digest('hex');

  const makeBody = (overrides: Partial<StellarWebhookDto> = {}) => ({
    eventId: 'evt-123',
    timestamp: new Date().toISOString(),
    transactionHash: 'tx-hash-123',
    amount: '100.00',
    status: 'confirmed',
    ...overrides,
  });

  beforeEach(async () => {
    cacheStore = new Map();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StellarWebhookController],
      providers: [
        {
          provide: getQueueToken('stellar-webhook'),
          useValue: mockQueue,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: CACHE_MANAGER,
          useValue: mockCache,
        },
        {
          provide: LoggerService,
          useValue: mockLogger,
        },
      ],
    }).compile();

    controller = module.get<StellarWebhookController>(StellarWebhookController);
    queue = module.get(getQueueToken('stellar-webhook'));
    logger = module.get(LoggerService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should fail startup when STELLAR_WEBHOOK_SECRET is missing', () => {
    mockConfigService.get.mockReturnValueOnce(undefined);

    expect(() => controller.onModuleInit()).toThrow(
      'STELLAR_WEBHOOK_SECRET must be set',
    );
  });

  it('should successfully validate signature and add to queue', async () => {
    const body: StellarWebhookDto = makeBody();
    const expectedSignature = signBody(body);

    const result = await controller.handleWebhook(expectedSignature, body);

    expect(result).toEqual({ received: true });
    expect(queue.add).toHaveBeenCalledWith(
      'process-payment',
      body,
      expect.any(Object),
    );
    expect(mockCache.set).toHaveBeenCalledWith(
      'stellar-webhook:event:evt-123',
      expect.any(String),
      24 * 60 * 60 * 1000,
    );
    expect(logger.info).toHaveBeenCalled();
  });

  it('should throw UnauthorizedException if signature header is missing', async () => {
    const body: StellarWebhookDto = makeBody();

    await expect(
      controller.handleWebhook(undefined as any, body),
    ).rejects.toThrow(UnauthorizedException);
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('should throw UnauthorizedException if signature is invalid', async () => {
    const body: StellarWebhookDto = makeBody();

    await expect(controller.handleWebhook('invalid-sig', body)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('should reject replayed webhook with an old valid signature', async () => {
    const body: StellarWebhookDto = makeBody({
      timestamp: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
    });
    const expectedSignature = signBody(body);

    await expect(
      controller.handleWebhook(expectedSignature, body),
    ).rejects.toThrow(UnauthorizedException);
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('should reject duplicate webhook event IDs with a valid signature', async () => {
    const body: StellarWebhookDto = makeBody();
    const expectedSignature = signBody(body);

    await expect(
      controller.handleWebhook(expectedSignature, body),
    ).resolves.toEqual({ received: true });
    await expect(
      controller.handleWebhook(expectedSignature, body),
    ).rejects.toThrow(ConflictException);

    expect(queue.add).toHaveBeenCalledTimes(1);
  });
});
