import {
  Controller,
  Post,
  Body,
  Headers,
  UnauthorizedException,
  ConflictException,
  HttpCode,
  HttpStatus,
  Inject,
  OnModuleInit,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import * as crypto from 'crypto';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { LoggerService } from '../common/logger/logger.service';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

export class StellarWebhookDto {
  @IsString()
  @IsNotEmpty()
  eventId: string;

  @IsString()
  @IsNotEmpty()
  timestamp: string;

  @IsString()
  @IsNotEmpty()
  transactionHash: string;

  @IsOptional()
  amount?: any;

  @IsString()
  @IsOptional()
  status?: string;
}

@ApiTags('Stellar Webhooks')
@Controller('webhooks/stellar')
export class StellarWebhookController implements OnModuleInit {
  private static readonly SIGNATURE_TOLERANCE_MS = 5 * 60 * 1000;
  private static readonly EVENT_ID_TTL_MS = 24 * 60 * 60 * 1000;

  constructor(
    @InjectQueue('stellar-webhook')
    private readonly stellarWebhookQueue: Queue,
    private readonly configService: ConfigService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly logger: LoggerService,
  ) {}

  onModuleInit() {
    this.getWebhookSecret();
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive a signed Stellar payment webhook' })
  @ApiResponse({ status: 200, description: 'Webhook accepted and queued.' })
  @ApiResponse({
    status: 401,
    description: 'Invalid or missing webhook signature.',
  })
  async handleWebhook(
    @Headers('x-stellar-signature') signature: string,
    @Body() body: StellarWebhookDto,
  ) {
    this.logger.info('Received Stellar webhook request', {
      eventId: body.eventId,
      transactionHash: body.transactionHash,
    });

    if (!signature) {
      this.logger.warn('Stellar webhook rejected: Missing signature header');
      throw new UnauthorizedException('Missing signature header');
    }

    this.validateTimestamp(body.timestamp);

    const secret = this.getWebhookSecret();

    // Compute HMAC signature on the stringified body, including eventId and timestamp.
    const payload = JSON.stringify(body);
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    // Safe comparison of signature to prevent timing attacks
    const signatureBuffer = Buffer.from(signature, 'hex');
    const expectedSignatureBuffer = Buffer.from(expectedSignature, 'hex');

    if (
      signatureBuffer.length !== expectedSignatureBuffer.length ||
      !crypto.timingSafeEqual(signatureBuffer, expectedSignatureBuffer)
    ) {
      this.logger.warn('Stellar webhook rejected: Invalid signature');
      throw new UnauthorizedException('Invalid signature');
    }

    await this.rejectDuplicateEvent(body.eventId);

    // Add webhook to Bull queue for asynchronous processing
    await this.stellarWebhookQueue.add('process-payment', body, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: true,
      removeOnFail: false,
    });

    this.logger.info('Stellar webhook accepted and queued for processing', {
      eventId: body.eventId,
      transactionHash: body.transactionHash,
    });

    return { received: true };
  }

  private getWebhookSecret(): string {
    const secret = this.configService.get<string>('STELLAR_WEBHOOK_SECRET');

    if (!secret || secret.trim() === '') {
      throw new Error('STELLAR_WEBHOOK_SECRET must be set');
    }

    return secret;
  }

  private validateTimestamp(timestamp: string): void {
    const timestampMs = Date.parse(timestamp);

    if (Number.isNaN(timestampMs)) {
      this.logger.warn('Stellar webhook rejected: Invalid timestamp');
      throw new UnauthorizedException('Invalid timestamp');
    }

    const ageMs = Math.abs(Date.now() - timestampMs);

    if (ageMs > StellarWebhookController.SIGNATURE_TOLERANCE_MS) {
      this.logger.warn('Stellar webhook rejected: Stale timestamp', {
        timestamp,
      });
      throw new UnauthorizedException('Stale timestamp');
    }
  }

  private async rejectDuplicateEvent(eventId: string): Promise<void> {
    const cacheKey = `stellar-webhook:event:${eventId}`;
    const alreadyProcessed = await this.cache.get<string>(cacheKey);

    if (alreadyProcessed) {
      this.logger.warn('Stellar webhook rejected: Duplicate event', {
        eventId,
      });
      throw new ConflictException('Duplicate event');
    }

    await this.cache.set(
      cacheKey,
      new Date().toISOString(),
      StellarWebhookController.EVENT_ID_TTL_MS,
    );
  }
}
