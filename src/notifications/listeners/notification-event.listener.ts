import { Injectable, Logger } from '@nestjs/common';
  import { OnEvent } from '@nestjs/event-emitter';
  import { NotificationEntity } from '../notification.entity';
  
  export interface TransactionReceivedEvent {
    userId: string;
    transactionId: string;
    amount: number;
    currency: string;
    fromUser?: string;
    metadata?: Record<string, any>;
  }
  
  export interface PaymentEvent {
    userId: string;
    paymentId: string;
    amount: number;
    currency: string;
    status: 'success' | 'failed';
    metadata?: Record<string, any>;
  }
  
  @Injectable()
  export class NotificationEventListener {
    private readonly logger = new Logger(NotificationEventListener.name);
  
    @OnEvent('transaction.received')
    async handleTransactionReceived(event: TransactionReceivedEvent) {
      this.logger.log(`Transaction received event for user ${event.userId}: ${event.amount} ${event.currency}`);
    
    }
  
    @OnEvent('payment.completed')
    async handlePaymentCompleted(event: PaymentEvent) {
      this.logger.log(`Payment ${event.status} event for user ${event.userId}: ${event.amount} ${event.currency}`);
      
      // Handle payment success/failure notifications
    }
  
    @OnEvent('notification.created')
    async handleNotificationCreated(notification: NotificationEntity) {
      this.logger.log(`Notification created: ${notification.id} for user ${notification.userId}`);
      
      // Here you could integrate with:
      // - WebSocket for real-time notifications
      // - Push notification services (FCM, APNS)
      // - Email services
      // - SMS services
      
      this.sendRealTimeNotification(notification);
    }
  
    @OnEvent('notification.read')
    async handleNotificationRead(notification: NotificationEntity) {
      this.logger.log(`Notification read: ${notification.id}`);
      
      // Analytics, metrics, etc.
    }
  
    @OnEvent('notification.send_push')
    async handleSendPushNotification(data: any) {
      this.logger.log(`Sending push notification to user ${data.userId}: ${data.title}`);
      
      // Integrate with push notification service
    }
  
    private sendRealTimeNotification(notification: NotificationEntity) {
      this.logger.debug(`Real-time notification sent for: ${notification.id}`);
    }
  }