export interface INotificationService {
    createNotification(dto: CreateNotificationDto): Promise<NotificationEntity>;
    sendTransactionReceivedNotification(userId: string, transactionId: string, amount: number, currency?: string): Promise<NotificationEntity>;
    getUserNotifications(userId: string, query: NotificationQueryDto): Promise<any>;
    markAsRead(notificationId: string, userId: string): Promise<NotificationEntity>;
    deleteNotification(notificationId: string, userId: string): Promise<void>;
  }
  
  export interface NotificationTemplate {
    type: NotificationType;
    title: string;
    messageTemplate: string;
    channel: NotificationChannel;
    priority: NotificationPriority;
  }
  
  export interface NotificationPreferences {
    userId: string;
    emailEnabled: boolean;
    pushEnabled: boolean;
    smsEnabled: boolean;
    inAppEnabled: boolean;
    quietHoursStart?: string;
    quietHoursEnd?: string;
    allowedTypes: NotificationType[];
  }