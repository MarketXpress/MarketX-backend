import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { WebhooksService } from '../webhooks.service';
import { WebhookEventType } from '../entities/webhook.entity';

export interface PlatformEvent {
  type: WebhookEventType;
  data: any;
  userId?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

@Injectable()
export class EventDispatcherService {
  private readonly logger = new Logger(EventDispatcherService.name);

  constructor(
    private eventEmitter: EventEmitter2,
    private webhooksService: WebhooksService,
  ) {
    this.setupEventListeners();
  }

  async dispatch(event: PlatformEvent): Promise<void> {
    this.logger.log(`Dispatching event: ${event.type}`);
    
    // Emit internal event for other services
    this.eventEmitter.emit(event.type, event);
    
    // Dispatch to external webhooks
    await this.webhooksService.dispatchEvent(event.type, {
      ...event.data,
      userId: event.userId,
      timestamp: event.timestamp,
      metadata: event.metadata,
    });
  }

  // Convenience methods for common events
  async dispatchUserCreated(userData: any): Promise<void> {
    await this.dispatch({
      type: WebhookEventType.USER_CREATED,
      data: userData,
      userId: userData.id,
      timestamp: new Date(),
    });
  }

  async dispatchUserUpdated(userData: any): Promise<void> {
    await this.dispatch({
      type: WebhookEventType.USER_UPDATED,
      data: userData,
      userId: userData.id,
      timestamp: new Date(),
    });
  }

  async dispatchOrderCreated(orderData: any): Promise<void> {
    await this.dispatch({
      type: WebhookEventType.ORDER_CREATED,
      data: orderData,
      userId: orderData.userId,
      timestamp: new Date(),
    });
  }

  async dispatchPaymentSuccess(paymentData: any): Promise<void> {
    await this.dispatch({
      type: WebhookEventType.PAYMENT_SUCCESS,
      data: paymentData,
      userId: paymentData.userId,
      timestamp: new Date(),
    });
  }

  private setupEventListeners(): void {
    // Listen to internal events and potentially transform them
    this.eventEmitter.on('**', (event: any) => {
      this.logger.debug(`Internal event received: ${JSON.stringify(event)}`);
    });
  }
}
