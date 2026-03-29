import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationsService } from '../notifications/notifications.service';
import {
  NotificationChannel,
  NotificationPriority,
  NotificationType,
} from '../notifications/notification.entity';

@Injectable()
export class RefundsListener {
  constructor(private readonly notifications: NotificationsService) {}

  @OnEvent('refund.requested')
  async handleRefundRequested(payload: any) {
    await this.notifications.createNotification({
      userId: payload.buyerId,
      title: 'Refund Request Submitted',
      message: `Your refund request for order ${payload.orderId} of amount ${payload.amount} has been submitted and is pending admin review.`,
      type: NotificationType.ORDER_UPDATED,
      channel: NotificationChannel.IN_APP,
      priority: NotificationPriority.HIGH,
      relatedEntityId: payload.refundId,
      relatedEntityType: 'refund',
      metadata: payload,
    } as any);
  }

  @OnEvent('refund.processed')
  async handleRefundProcessed(payload: any) {
    await this.notifications.createNotification({
      userId: payload.buyerId,
      title: 'Refund Processed Successfully',
      message: `Your refund of ${payload.amount} for order ${payload.orderId} has been processed. Transaction: ${payload.txHash}`,
      type: NotificationType.TRANSACTION_RECEIVED,
      channel: NotificationChannel.IN_APP,
      priority: NotificationPriority.HIGH,
      relatedEntityId: payload.refundId,
      relatedEntityType: 'refund',
      metadata: payload,
    } as any);
  }

  @OnEvent('refund.rejected')
  async handleRefundRejected(payload: any) {
    await this.notifications.createNotification({
      userId: payload.buyerId,
      title: 'Refund Request Rejected',
      message: `Your refund request for order ${payload.orderId} has been reviewed and rejected.`,
      type: NotificationType.ORDER_UPDATED,
      channel: NotificationChannel.IN_APP,
      priority: NotificationPriority.HIGH,
      relatedEntityId: payload.refundId,
      relatedEntityType: 'refund',
      metadata: payload,
    } as any);
  }

  @OnEvent('refund.failed')
  async handleRefundFailed(payload: any) {
    await this.notifications.createNotification({
      userId: payload.buyerId,
      title: 'Refund Transaction Failed',
      message: `Your refund transaction failed due to: ${payload.error}. Our team has been alerted.`,
      type: NotificationType.SYSTEM_ALERT,
      channel: NotificationChannel.IN_APP,
      priority: NotificationPriority.HIGH,
      relatedEntityId: payload.refundId,
      relatedEntityType: 'refund',
      metadata: payload,
    } as any);
  }

  @OnEvent('refund.inventory.restore')
  handleInventoryRestore(payload: any) {
    console.log('Restore inventory for order:', payload.orderId);
  }
}
