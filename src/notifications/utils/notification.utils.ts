import { NotificationEntity, NotificationType, NotificationPriority } from '../notification.entity';

export class NotificationUtils {
  /**
   * Generate notification title based on type and metadata
   */
  static generateTitle(type: NotificationType, metadata?: Record<string, any>): string {
    const titleMap: Record<NotificationType, string> = {
      [NotificationType.TRANSACTION_RECEIVED]: 'Transaction Received',
      [NotificationType.TRANSACTION_SENT]: 'Transaction Sent',
      [NotificationType.PAYMENT_SUCCESS]: 'Payment Successful',
      [NotificationType.PAYMENT_FAILED]: 'Payment Failed',
      [NotificationType.SYSTEM_ALERT]: 'System Alert',
      [NotificationType.ACCOUNT_UPDATE]: 'Account Update',
      [NotificationType.SECURITY_ALERT]: 'Security Alert',
      [NotificationType.PROMOTION]: 'Special Offer',
      [NotificationType.REMINDER]: 'Reminder',
      [NotificationType.PRICE_DROP]: 'Price Drop',
      [NotificationType.ORDER_CREATED]: 'Order Created',
      [NotificationType.ORDER_UPDATED]: 'Order Updated',
      [NotificationType.ORDER_CANCELLED]: 'Order Cancelled',
      [NotificationType.ORDER_COMPLETED]: 'Order Completed',
      [NotificationType.SHIPMENT_UPDATE]: 'Shipment Update',
      [NotificationType.PASSWORD_RESET]: 'Password Reset',
    };

    return titleMap[type] || 'Notification';
  }

  /**
   * Generate notification message with template substitution
   */
  static generateMessage(template: string, variables: Record<string, any>): string {
    return template.replace(/\{(\w+)\}/g, (match, key) => {
      return variables[key] !== undefined ? String(variables[key]) : match;
    });
  }

  /**
   * Determine notification priority based on type and amount
   */
  static determinePriority(
    type: NotificationType,
    amount?: number
  ): NotificationPriority {
    // High priority for security alerts and large transactions
    if (type === NotificationType.SECURITY_ALERT) {
      return NotificationPriority.URGENT;
    }

    if (type === NotificationType.PAYMENT_FAILED) {
      return NotificationPriority.HIGH;
    }

    if (amount && amount > 1000) {
      return NotificationPriority.HIGH;
    }

    if (type === NotificationType.TRANSACTION_RECEIVED ||
      type === NotificationType.PAYMENT_SUCCESS) {
      return NotificationPriority.MEDIUM;
    }

    return NotificationPriority.LOW;
  }

  /**
   * Format currency amount for display
   */
  static formatAmount(amount: number, currency: string = 'USD'): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  }

  /**
   * Check if notification should be sent based on user preferences
   */
  static shouldSendNotification(
    notification: Partial<NotificationEntity>,
    userPreferences?: any
  ): boolean {
    if (!userPreferences) return true;

    // Check if notification type is allowed
    if (userPreferences.allowedTypes &&
      !userPreferences.allowedTypes.includes(notification.type)) {
      return false;
    }

    // Check quiet hours
    if (userPreferences.quietHoursStart && userPreferences.quietHoursEnd) {
      const now = new Date();
      const currentHour = now.getHours();
      const quietStart = parseInt(userPreferences.quietHoursStart);
      const quietEnd = parseInt(userPreferences.quietHoursEnd);

      if (quietStart <= quietEnd) {
        // Same day quiet hours (e.g., 22:00 to 08:00)
        if (currentHour >= quietStart && currentHour < quietEnd) {
          return notification.priority === NotificationPriority.URGENT;
        }
      } else {
        // Overnight quiet hours (e.g., 22:00 to 08:00)
        if (currentHour >= quietStart || currentHour < quietEnd) {
          return notification.priority === NotificationPriority.URGENT;
        }
      }
    }

    return true;
  }
}
