export interface NotificationConfig {
    defaultChannel: string;
    defaultPriority: string;
    retentionDays: number;
    batchSize: number;
    rateLimiting: {
      enabled: boolean;
      maxPerUser: number;
      timeWindow: number; // in seconds
    };
    templates: {
      transactionReceived: {
        title: string;
        message: string;
      };
      paymentSuccess: {
        title: string;
        message: string;
      };
      paymentFailed: {
        title: string;
        message: string;
      };
    };
  }
  
  export const defaultNotificationConfig: NotificationConfig = {
    defaultChannel: 'in_app',
    defaultPriority: 'medium',
    retentionDays: 90,
    batchSize: 100,
    rateLimiting: {
      enabled: true,
      maxPerUser: 100,
      timeWindow: 3600, // 1 hour
    },
    templates: {
      transactionReceived: {
        title: 'Transaction Received',
        message: 'You received {currency} {amount}',
      },
      paymentSuccess: {
        title: 'Payment Successful',
        message: 'Your payment of {currency} {amount} was successful',
      },
      paymentFailed: {
        title: 'Payment Failed',
        message: 'Your payment of {currency} {amount} failed. Please try again.',
      },
    },
  };
  