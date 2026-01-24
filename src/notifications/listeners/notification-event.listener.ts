import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationsService } from '../notifications.service';
import { NotificationType } from '../entities/notification.entity';
import {
  OrderCreatedEvent,
  OrderUpdatedEvent,
  OrderCancelledEvent,
  OrderCompletedEvent,
} from '../events/order.events';
import {
  PaymentReceivedEvent,
  PaymentFailedEvent,
} from '../events/payment.events';
import { MessageReceivedEvent } from '../events/message.events';

@Injectable()
export class NotificationEventListener {
  constructor(private readonly notificationsService: NotificationsService) {}

  @OnEvent('order.created')
  async handleOrderCreated(event: OrderCreatedEvent) {
    await this.notificationsService.createNotification({
      userId: event.userId,
      type: NotificationType.ORDER_CREATED,
      title: 'Order Created',
      message: `Your order #${event.orderNumber} has been created successfully. Total: $${event.totalAmount}`,
      metadata: {
        orderId: event.orderId,
        orderNumber: event.orderNumber,
        totalAmount: event.totalAmount,
        items: event.items,
      },
    });
  }

  @OnEvent('order.updated')
  async handleOrderUpdated(event: OrderUpdatedEvent) {
    await this.notificationsService.createNotification({
      userId: event.userId,
      type: NotificationType.ORDER_UPDATED,
      title: 'Order Status Updated',
      message: `Your order #${event.orderNumber} status changed from ${event.previousStatus} to ${event.status}`,
      metadata: {
        orderId: event.orderId,
        orderNumber: event.orderNumber,
        status: event.status,
        previousStatus: event.previousStatus,
      },
    });
  }

  @OnEvent('order.cancelled')
  async handleOrderCancelled(event: OrderCancelledEvent) {
    await this.notificationsService.createNotification({
      userId: event.userId,
      type: NotificationType.ORDER_CANCELLED,
      title: 'Order Cancelled',
      message: `Your order #${event.orderNumber} has been cancelled. Reason: ${event.reason}`,
      metadata: {
        orderId: event.orderId,
        orderNumber: event.orderNumber,
        reason: event.reason,
      },
    });
  }

  @OnEvent('order.completed')
  async handleOrderCompleted(event: OrderCompletedEvent) {
    await this.notificationsService.createNotification({
      userId: event.userId,
      type: NotificationType.ORDER_COMPLETED,
      title: 'Order Completed',
      message: `Your order #${event.orderNumber} has been completed. Thank you for your purchase!`,
      metadata: {
        orderId: event.orderId,
        orderNumber: event.orderNumber,
        totalAmount: event.totalAmount,
      },
    });
  }

  @OnEvent('payment.received')
  async handlePaymentReceived(event: PaymentReceivedEvent) {
    await this.notificationsService.createNotification({
      userId: event.userId,
      type: NotificationType.PAYMENT_RECEIVED,
      title: 'Payment Received',
      message: `Your payment of $${event.amount} has been received successfully via ${event.paymentMethod}`,
      metadata: {
        paymentId: event.paymentId,
        orderId: event.orderId,
        amount: event.amount,
        paymentMethod: event.paymentMethod,
      },
    });
  }

  @OnEvent('payment.failed')
  async handlePaymentFailed(event: PaymentFailedEvent) {
    await this.notificationsService.createNotification({
      userId: event.userId,
      type: NotificationType.PAYMENT_FAILED,
      title: 'Payment Failed',
      message: `Your payment of $${event.amount} failed. Reason: ${event.reason}`,
      metadata: {
        paymentId: event.paymentId,
        orderId: event.orderId,
        amount: event.amount,
        reason: event.reason,
      },
    });
  }

  @OnEvent('message.received')
  async handleMessageReceived(event: MessageReceivedEvent) {
    await this.notificationsService.createNotification({
      userId: event.recipientId,
      type: NotificationType.MESSAGE_RECEIVED,
      title: 'New Message',
      message: `You received a new message from ${event.senderName}`,
      metadata: {
        messageId: event.messageId,
        senderId: event.senderId,
        senderName: event.senderName,
        conversationId: event.conversationId,
        preview: event.content.substring(0, 50),
      },
    });
  }
}