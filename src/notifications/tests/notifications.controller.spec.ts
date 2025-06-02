import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsController } from '../notifications.controller';
import { NotificationsService } from '../notifications.service';
import { NotificationType, NotificationChannel, NotificationPriority } from '../notification.entity';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let service: NotificationsService;

  const mockNotificationsService = {
    createNotification: jest.fn(),
    sendTransactionReceivedNotification: jest.fn(),
    getUserNotifications: jest.fn(),
    getUserNotificationStats: jest.fn(),
    getNotificationById: jest.fn(),
    updateNotification: jest.fn(),
    markAsRead: jest.fn(),
    markAllAsRead: jest.fn(),
    markMultipleAsRead: jest.fn(),
    deleteNotification: jest.fn(),
    deleteMultipleNotifications: jest.fn(),
    sendBulkNotifications: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
      ],
    }).compile();

    controller = module.get<NotificationsController>(NotificationsController);
    service = module.get<NotificationsService>(NotificationsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createNotification', () => {
    it('should create a notification', async () => {
      const createDto = {
        userId: 'user-123',
        title: 'Test Notification',
        message: 'Test message',
        type: NotificationType.SYSTEM_ALERT,
        channel: NotificationChannel.IN_APP,
        priority: NotificationPriority.MEDIUM,
      };

      const mockResult = { id: 'notification-123', ...createDto };
      mockNotificationsService.createNotification.mockResolvedValue(mockResult);

      const result = await controller.createNotification(createDto);

      expect(service.createNotification).toHaveBeenCalledWith(createDto);
      expect(result).toEqual(mockResult);
    });
  });

  describe('sendTransactionNotification', () => {
    it('should send transaction notification', async () => {
      const transactionDto = {
        userId: 'user-123',
        transactionId: 'txn-456',
        amount: 100,
        currency: 'USD',
      };

      const mockResult = { id: 'notification-123', title: 'Transaction Received' };
      mockNotificationsService.sendTransactionReceivedNotification.mockResolvedValue(mockResult);

      const result = await controller.sendTransactionNotification(transactionDto);

      expect(service.sendTransactionReceivedNotification).toHaveBeenCalledWith(
        transactionDto.userId,
        transactionDto.transactionId,
        transactionDto.amount,
        transactionDto.currency
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('getUserNotifications', () => {
    it('should get user notifications', async () => {
      const userId = 'user-123';
      const queryDto = { page: 1, limit: 10 };
      const mockResult = {
        notifications: [],
        total: 0,
        unreadCount: 0,
      };

      mockNotificationsService.getUserNotifications.mockResolvedValue(mockResult);

      const result = await controller.getUserNotifications(userId, queryDto);

      expect(service.getUserNotifications).toHaveBeenCalledWith(userId, queryDto);
      expect(result).toEqual(mockResult);
    });
  });
});

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
