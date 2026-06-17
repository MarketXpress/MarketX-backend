import { Test, TestingModule } from '@nestjs/testing';
import {
  StellarWebhookController,
  StellarWebhookDto,
} from './stellar-webhook.controller';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../common/logger/logger.service';
import { getQueueToken } from '@nestjs/bull';
import { UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';

describe('StellarWebhookController', () => {
  let controller: StellarWebhookController;
  let queue: any;
  let logger: any;

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

  const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  beforeEach(async () => {
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

  it('should successfully validate signature and add to queue', async () => {
    const body: StellarWebhookDto = {
      transactionHash: 'tx-hash-123',
      amount: '100.00',
      status: 'confirmed',
    };

    const payload = JSON.stringify(body);
    const expectedSignature = crypto
      .createHmac('sha256', 'test-secret')
      .update(payload)
      .digest('hex');

    const result = await controller.handleWebhook(expectedSignature, body);

    expect(result).toEqual({ received: true });
    expect(queue.add).toHaveBeenCalledWith(
      'process-payment',
      body,
      expect.any(Object),
    );
    expect(logger.info).toHaveBeenCalled();
  });

  it('should throw UnauthorizedException if signature header is missing', async () => {
    const body: StellarWebhookDto = {
      transactionHash: 'tx-hash-123',
    };

    await expect(
      controller.handleWebhook(undefined as any, body),
    ).rejects.toThrow(UnauthorizedException);
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('should throw UnauthorizedException if signature is invalid', async () => {
    const body: StellarWebhookDto = {
      transactionHash: 'tx-hash-123',
    };

    await expect(controller.handleWebhook('invalid-sig', body)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(queue.add).not.toHaveBeenCalled();
  });
});
