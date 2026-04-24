import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

import {
  WEBHOOK_VERIFIED_OPTIONS,
  WEBHOOK_NONCE_CACHE_PREFIX,
} from '../constants/webhook.constants';
import { WebhookVerifiedOptions } from '../decorators/webhook-verified.decorator';
import { WebhooksMetricsService } from '../services/webhooks-metrics.service';
import { RedisCacheService } from '../../redis-caching/redis-cache.service';

@Injectable()
export class WebhookVerificationGuard implements CanActivate {
  private readonly logger = new Logger(WebhookVerificationGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
    private readonly redisCache: RedisCacheService,
    private readonly metricsService: WebhooksMetricsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.get<WebhookVerifiedOptions>(
      WEBHOOK_VERIFIED_OPTIONS,
      context.getHandler(),
    );

    if (!options) {
      return true; // No verification required if no options set
    }

    const request = context.switchToHttp().getRequest<Request>();
    const startTime = Date.now();

    try {
      await this.verifyWebhook(request, options);

      // Record success metrics
      await this.metricsService.recordVerification(
        true,
        Date.now() - startTime,
      );
      return true;
    } catch (error) {
      // Record failure metrics
      await this.metricsService.recordVerification(
        false,
        Date.now() - startTime,
      );

      this.logger.warn(`Webhook verification failed: ${error.message}`, {
        url: request.url,
        ip: request.ip,
        userAgent: request.get('User-Agent'),
      });

      throw error;
    }
  }

  private async verifyWebhook(
    request: Request,
    options: WebhookVerifiedOptions,
  ): Promise<void> {
    const body = request.body;
    const rawBody = this.getRawBody(request);

    // 1. Verify signature
    await this.verifySignature(rawBody, request, options);

    // 2. Verify timestamp (replay defense)
    await this.verifyTimestamp(request, options);

    // 3. Verify nonce (replay defense)
    await this.verifyNonce(request, options);
  }

  private async verifySignature(
    rawBody: string,
    request: Request,
    options: WebhookVerifiedOptions,
  ): Promise<void> {
    const signature = request.get(options.signatureHeader!);
    const secret = this.getSecret(request, options);

    if (!signature) {
      throw new UnauthorizedException('Missing webhook signature');
    }

    if (!secret) {
      throw new UnauthorizedException('Missing webhook secret');
    }

    let expectedSignature: string;

    switch (options.provider) {
      case 'stripe':
        expectedSignature = this.verifyStripeSignature(
          rawBody,
          signature,
          secret,
        );
        break;
      case 'sendgrid':
        expectedSignature = this.verifySendGridSignature(
          rawBody,
          signature,
          secret,
        );
        break;
      case 'stellar':
        expectedSignature = this.verifyStellarSignature(
          rawBody,
          signature,
          secret,
        );
        break;
      default:
        expectedSignature = this.verifyGenericSignature(
          rawBody,
          signature,
          secret,
        );
    }

    if (!this.secureCompare(signature, expectedSignature)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
  }

  private verifyStripeSignature(
    payload: string,
    signature: string,
    secret: string,
  ): string {
    const elements = signature.split(',');
    const timestampElement = elements.find((el) => el.startsWith('t='));
    const signatureElement = elements.find((el) => el.startsWith('v1='));

    if (!timestampElement || !signatureElement) {
      throw new UnauthorizedException('Invalid Stripe signature format');
    }

    const timestamp = timestampElement.substring(2);
    const signedPayload = `${timestamp}.${payload}`;

    return crypto
      .createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex')
      .replace(/(.{64})/g, '$1\n')
      .trim();
  }

  private verifySendGridSignature(
    payload: string,
    signature: string,
    secret: string,
  ): string {
    return crypto.createHmac('sha256', secret).update(payload).digest('base64');
  }

  private verifyStellarSignature(
    payload: string,
    signature: string,
    secret: string,
  ): string {
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  private verifyGenericSignature(
    payload: string,
    signature: string,
    secret: string,
  ): string {
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  private async verifyTimestamp(
    request: Request,
    options: WebhookVerifiedOptions,
  ): Promise<void> {
    const timestampHeader = request.get(options.timestampHeader!);

    if (!timestampHeader) {
      throw new BadRequestException('Missing timestamp header');
    }

    const timestamp = parseInt(timestampHeader, 10);
    if (isNaN(timestamp)) {
      throw new BadRequestException('Invalid timestamp format');
    }

    const now = Date.now();
    const tolerance = options.timestampToleranceMs || 300000; // 5 minutes default

    if (Math.abs(now - timestamp) > tolerance) {
      throw new UnauthorizedException('Timestamp outside tolerance window');
    }
  }

  private async verifyNonce(
    request: Request,
    options: WebhookVerifiedOptions,
  ): Promise<void> {
    const nonce = request.get(options.nonceHeader!);

    if (!nonce) {
      throw new BadRequestException('Missing nonce header');
    }

    const cacheKey = `${WEBHOOK_NONCE_CACHE_PREFIX}${nonce}`;

    // Check if nonce already exists (replay attack)
    const existing = await this.redisCache.get<string>(cacheKey);
    if (existing) {
      throw new UnauthorizedException('Nonce already used (replay attack)');
    }

    // Store nonce with expiration (24 hours)
    await this.redisCache.set(cacheKey, '1', 86400);
  }

  private getSecret(request: Request, options: WebhookVerifiedOptions): string {
    // Try to get secret from header first
    const headerSecret = request.get(options.secretHeader!);
    if (headerSecret) {
      return headerSecret;
    }

    // Fall back to config based on provider
    switch (options.provider) {
      case 'stripe':
        return this.configService.get<string>('STRIPE_WEBHOOK_SECRET')!;
      case 'sendgrid':
        return this.configService.get<string>('SENDGRID_WEBHOOK_SECRET')!;
      case 'stellar':
        return this.configService.get<string>('STELLAR_WEBHOOK_SECRET')!;
      default:
        return this.configService.get<string>('DEFAULT_WEBHOOK_SECRET')!;
    }
  }

  private getRawBody(request: Request): string {
    // In a real implementation, you'd need to use raw body middleware
    // For now, we'll stringify the parsed body
    return JSON.stringify(request.body);
  }

  private secureCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }
}
