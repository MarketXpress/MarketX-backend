import {
  Controller,
  Post,
  Body,
  Headers,
  UnauthorizedException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { LoggerService } from '../common/logger/logger.service';

export class StellarWebhookDto {
  @IsString()
  @IsNotEmpty()
  transactionHash: string;

  @IsOptional()
  amount?: any;

  @IsString()
  @IsOptional()
  status?: string;
}

@Controller('webhooks/stellar')
export class StellarWebhookController {
  constructor(
    @InjectQueue('stellar-webhook')
    private readonly stellarWebhookQueue: Queue,
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Headers('x-stellar-signature') signature: string,
    @Body() body: StellarWebhookDto,
  ) {
    this.logger.info('Received Stellar webhook request', {
      transactionHash: body.transactionHash,
    });

    if (!signature) {
      this.logger.warn('Stellar webhook rejected: Missing signature header');
      throw new UnauthorizedException('Missing signature header');
    }

    const secret =
      this.configService.get<string>('STELLAR_WEBHOOK_SECRET') ||
      'stellar-webhook-secret-key-change-in-production';

    // Compute HMAC signature on the stringified body
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
      transactionHash: body.transactionHash,
    });

    return { received: true };
  }
}
