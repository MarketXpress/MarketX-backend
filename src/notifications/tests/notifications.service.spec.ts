import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { NotificationsService } from '../notifications.service';
import { NotificationEntity, NotificationType, NotificationChannel, NotificationPriority } from '../notification.entity';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let repository: Repository<NotificationEntity>;
  let eventEmitter: EventEmitter2;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  };

  const mockEventEmitter = {
    emit: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: getRepositoryToken(NotificationEntity),
          useValue: mockRepository,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    repository = module.get<Repository<NotificationEntity>>(getRepositoryToken(NotificationEntity));
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createNotification', () => {
    it('should create and save a notification', async () => {
      const createDto = {
        userId: 'user-123',
        title: 'Test Notification',
        message: 'This is a test notification',
        type: NotificationType.SYSTEM_ALERT,
        channel: NotificationChannel.IN_APP,
        priority: NotificationPriority.MEDIUM,
      };

      const mockNotification = {
        id: 'notification-123',
        ...createDto,
        read: false,
        createdAt: new Date(),
      };

      mockRepository.create.mockReturnValue(mockNotification);
      mockRepository.save.mockResolvedValue(mockNotification);

      const result = await service.createNotification(createDto);

      expect(mockRepository.create).toHaveBeenCalledWith(expect.objectContaining(createDto));
      expect(mockRepository.save).toHaveBeenCalledWith(mockNotification);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('notification.created', mockNotification);
      expect(result).toEqual(mockNotification);
    });
  });

  describe('sendTransactionReceivedNotification', () => {
    it('should send a transaction received notification', async () => {
      const userId = 'user-123';
      const transactionId = 'txn-456';
      const amount = 100.50;
      const currency = 'USD';

      const mockNotification = {
        id: 'notification-123',
        userId,
        title: 'Transaction Received',
        message: `You received ${currency} ${amount.toFixed(2)}`,
        type: NotificationType.TRANSACTION_RECEIVED,
        channel: NotificationChannel.IN_APP,
        priority: NotificationPriority.HIGH,
        relatedEntityId: transactionId,
        relatedEntityType: 'transaction',
        metadata: { amount, currency, transactionId },
        read: false,
        createdAt: new Date(),
      };

      mockRepository.create.mockReturnValue(mockNotification);
      mockRepository.save.mockResolvedValue(mockNotification);

      const result = await service.sendTransactionReceivedNotification(userId, transactionId, amount, currency);

      expect(result.title).toBe('Transaction Received');
      expect(result.message).toBe('You received USD 100.50');
      expect(result.type).toBe(NotificationType.TRANSACTION_RECEIVED);
      expect(result.priority).toBe(NotificationPriority.HIGH);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('notification.send_push', expect.any(Object));
    });
  });

  describe('getUserNotifications', () => {
    it('should return user notifications with pagination', async () => {
      const userId = 'user-123';
      const queryDto = { page: 1, limit: 10 };

      const mockNotifications = [
        { id: '1', userId, title: 'Notification 1', read: false },
        { id: '2', userId, title: 'Notification 2', read: true },
      ];

      mockRepository.findAndCount.mockResolvedValue([mockNotifications, 2]);
      mockRepository.count.mockResolvedValue(1); // unread count

      const result = await service.getUserNotifications(userId, queryDto);

      expect(result.notifications).toEqual(mockNotifications);
      expect(result.total).toBe(2);
      expect(result.unreadCount).toBe(1);
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      const notificationId = 'notification-123';
      const userId = 'user-123';

      const mockNotification = {
        id: notificationId,
        userId,
        read: false,
        readAt: null,
      };

      const updatedNotification = {
        ...mockNotification,
        read: true,
        readAt: expect.any(Date),
      };

      mockRepository.findOne.mockResolvedValue(mockNotification);
      mockRepository.save.mockResolvedValue(updatedNotification);

      const result = await service.markAsRead(notificationId, userId);

      expect(result.read).toBe(true);
      expect(result.readAt).toBeDefined();
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('notification.read', expect.any(Object));
    });

    it('should throw NotFoundException for non-existent notification', async () => {
      const notificationId = 'non-existent';
      const userId = 'user-123';

      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.markAsRead(notificationId, userId)).rejects.toThrow('Notification not found');
    });
  });
});