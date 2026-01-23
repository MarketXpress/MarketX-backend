import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as crypto from 'crypto';
import { firstValueFrom } from 'rxjs';
import { Webhook, WebhookEventType } from './entities/webhook.entity';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';
import { WebhookDelivery } from './interfaces/webhook-delivery.interface';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);
  private readonly deliveryQueue = new Map<string, WebhookDelivery>();
  private readonly maxRetries = 5;
  private readonly timeoutMs = 10000; // 10 seconds

  constructor(
    @InjectRepository(Webhook)
    private webhookRepository: Repository<Webhook>,
    private httpService: HttpService,
    private configService: ConfigService,
  ) {}

  async create(createWebhookDto: CreateWebhookDto): Promise<Webhook> {
    const webhook = this.webhookRepository.create(createWebhookDto);
    return await this.webhookRepository.save(webhook);
  }

  async findAll(): Promise<Webhook[]> {
    return await this.webhookRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Webhook> {
    const webhook = await this.webhookRepository.findOne({ where: { id } });
    if (!webhook) {
      throw new NotFoundException(`Webhook with ID ${id} not found`);
    }
    return webhook;
  }

  async update(id: string, updateWebhookDto: UpdateWebhookDto): Promise<Webhook> {
    await this.webhookRepository.update(id, updateWebhookDto);
    return await this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const result = await this.webhookRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Webhook with ID ${id} not found`);
    }
  }

  async findActiveWebhooksForEvent(eventType: WebhookEventType): Promise<Webhook[]> {
    return await this.webhookRepository.find({
      where: {
        isActive: true,
        events: eventType as any, // TypeORM simple-array handling
      },
    });
  }

  async dispatchEvent(eventType: WebhookEventType, payload: any): Promise<void> {
    const webhooks = await this.findActiveWebhooksForEvent(eventType);
    
    this.logger.log(`Dispatching ${eventType} event to ${webhooks.length} webhooks`);

    for (const webhook of webhooks) {
      await this.scheduleDelivery(webhook, eventType, payload);
    }
  }

  private async scheduleDelivery(
    webhook: Webhook,
    eventType: WebhookEventType,
    payload: any,
  ): Promise<void> {
    const deliveryId = crypto.randomUUID();
    const signature = this.generateSignature(payload, webhook.secret);

    const delivery: WebhookDelivery = {
      id: deliveryId,
      webhookId: webhook.id,
      eventType,
      payload,
      signature,
      attempts: 0,
      maxRetries: this.maxRetries,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.deliveryQueue.set(deliveryId, delivery);
    
    // Start immediate delivery attempt
    setImmediate(() => this.attemptDelivery(deliveryId));
  }

  private async attemptDelivery(deliveryId: string): Promise<void> {
    const delivery = this.deliveryQueue.get(deliveryId);
    if (!delivery) return;

    delivery.attempts++;
    delivery.updatedAt = new Date();

    try {
      const webhook = await this.findOne(delivery.webhookId);
      
      const response = await firstValueFrom(
        this.httpService.post(
          webhook.url,
          {
            event: delivery.eventType,
            data: delivery.payload,
            timestamp: delivery.createdAt.toISOString(),
            delivery_id: delivery.id,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'X-Webhook-Signature': delivery.signature,
              'X-Webhook-Event': delivery.eventType,
              'User-Agent': 'Webhook-Service/1.0',
            },
            timeout: this.timeoutMs,
          },
        ),
      ) as any; // Type assertion to allow property access

      // Success
      delivery.status = 'success';
      delivery.response = {
        statusCode: (response as any).status,
        body: JSON.stringify((response as any).data),
        headers: (response as any).headers as Record<string, string>,
      };

      await this.updateWebhookSuccess(webhook.id);
      this.logger.log(`Webhook delivery ${deliveryId} succeeded`);
      
      // Remove from queue after success
      setTimeout(() => this.deliveryQueue.delete(deliveryId), 60000); // Keep for 1 minute for reference

    } catch (error) {
      this.logger.warn(`Webhook delivery ${deliveryId} failed (attempt ${delivery.attempts}): ${error.message}`);
      
      delivery.response = {
        statusCode: error.response?.status || 0,
        body: error.message,
        headers: error.response?.headers || {},
      };

      if (delivery.attempts >= delivery.maxRetries) {
        delivery.status = 'exhausted';
        await this.updateWebhookFailure(delivery.webhookId);
        this.logger.error(`Webhook delivery ${deliveryId} exhausted all retries`);
        
        // Remove from queue after exhaustion
        setTimeout(() => this.deliveryQueue.delete(deliveryId), 300000); // Keep for 5 minutes
      } else {
        delivery.status = 'failed';
        const delay = this.calculateBackoffDelay(delivery.attempts);
        delivery.nextRetryAt = new Date(Date.now() + delay);
        
        this.logger.log(`Scheduling retry for delivery ${deliveryId} in ${delay}ms`);
        setTimeout(() => this.attemptDelivery(deliveryId), delay);
      }
    }
  }

  private calculateBackoffDelay(attempt: number): number {
    // Exponential backoff: 2^attempt * 1000ms (1s, 2s, 4s, 8s, 16s)
    return Math.min(Math.pow(2, attempt) * 1000, 60000); // Cap at 60 seconds
  }

  private generateSignature(payload: any, secret: string): string {
    const body = JSON.stringify(payload);
    return crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');
  }

  private async updateWebhookSuccess(webhookId: string): Promise<void> {
    await this.webhookRepository.update(webhookId, {
      failureCount: 0,
      lastSuccessAt: new Date(),
    });
  }

  private async updateWebhookFailure(webhookId: string): Promise<void> {
    await this.webhookRepository.increment(
      { id: webhookId },
      'failureCount',
      1,
    );
    await this.webhookRepository.update(webhookId, {
      lastFailureAt: new Date(),
    });
  }

  async testWebhook(id: string, eventType: WebhookEventType, payload?: any): Promise<any> {
    const webhook = await this.findOne(id);
    
    const testPayload = payload || {
      test: true,
      message: 'This is a test webhook delivery',
      timestamp: new Date().toISOString(),
    };

    try {
      const signature = this.generateSignature(testPayload, webhook.secret);
      
      const response = await firstValueFrom(
        this.httpService.post(
          webhook.url,
          {
            event: eventType,
            data: testPayload,
            timestamp: new Date().toISOString(),
            delivery_id: `test-${crypto.randomUUID()}`,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'X-Webhook-Signature': signature,
              'X-Webhook-Event': eventType,
              'User-Agent': 'Webhook-Service/1.0 (Test)',
            },
            timeout: this.timeoutMs,
          },
        ),
      );

      return {
        success: true,
        statusCode: (response as any).status,
        response: (response as any).data,
        headers: (response as any).headers,
      };
    } catch (error) {
      return {
        success: false,
        statusCode: error.response?.status || 0,
        error: error.message,
        response: error.response?.data,
      };
    }
  }

  getDeliveryStatus(deliveryId: string): WebhookDelivery | undefined {
    return this.deliveryQueue.get(deliveryId);
  }

  getQueueStats(): { pending: number; total: number; failed: number } {
    const deliveries = Array.from(this.deliveryQueue.values());
    return {
      total: deliveries.length,
      pending: deliveries.filter(d => d.status === 'pending').length,
      failed: deliveries.filter(d => d.status === 'failed').length,
    };
  }

  @Cron(CronExpression.EVERY_MINUTE)
  private async cleanupOldDeliveries(): Promise<void> {
    const now = Date.now();
    const cutoff = 24 * 60 * 60 * 1000; // 24 hours
    
    for (const [id, delivery] of this.deliveryQueue.entries()) {
      if (now - delivery.createdAt.getTime() > cutoff) {
        this.deliveryQueue.delete(id);
      }
    }
  }

  // Validate webhook signature (for incoming webhook validation)
  validateSignature(payload: string, signature: string, secret: string): boolean {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex'),
    );
  }
}