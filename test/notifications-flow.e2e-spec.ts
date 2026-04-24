import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bull';
import { INestApplication } from '@nestjs/common';

import {
  NotificationChannel,
  NotificationEntity,
  NotificationStatus,
  NotificationType,
} from '../src/notifications/notification.entity';
import { NotificationPreferencesEntity } from '../src/notifications/notification-preferences.entity';
import { Users } from '../src/users/users.entity';
import { NotificationsService } from '../src/notifications/notifications.service';
import { NotificationEventListener } from '../src/notifications/listeners/notification-event.listener';
import { NotificationGateway } from '../src/notifications/notification.gateway';
import { I18nService } from '../src/i18n/i18n.service';
import { RetryStrategyService } from '../src/notifications/retry-strategy.service';
import { DeadLetterQueueService } from '../src/notifications/dead-letter-queue.service';
import { EventNames } from '../src/common/events';
import { EMAIL_QUEUE } from '../src/job-processing/queue.constants';

type MutableNotification = NotificationEntity & { id: string };

describe('Notifications flow (e2e)', () => {
  let moduleRef: TestingModule;
  let app: INestApplication;
  let eventEmitter: EventEmitter2;

  const notifications: MutableNotification[] = [];
  const preferences = new Map<string, NotificationPreferencesEntity>();
  const users = new Map<string, Partial<Users>>();
  let seq = 1;

  const emailQueue = {
    add: jest.fn(async () => ({})),
  };

  const notificationGateway = {
    sendNotification: jest.fn(),
  };

  const retryStrategy = {
    getConfigForNotificationType: jest.fn(() => ({})),
    executeWithRetry: jest.fn(async (operation: () => Promise<void>) => {
      await operation();
      return {
        success: true,
        attempts: [],
        totalDurationMs: 0,
      };
    }),
  };

  const i18nService = {
    translate: jest.fn(async () => 'translated'),
  };

  const deadLetterQueueService = {
    routeToDLQ: jest.fn(),
  };

  const notificationRepository = {
    create: jest.fn((data: Partial<NotificationEntity>) => ({
      ...data,
      id: data.id || `notif-${seq++}`,
      status: data.status || NotificationStatus.PENDING,
      read: data.read || false,
      isRead: data.isRead || false,
      createdAt: data.createdAt || new Date(),
      updatedAt: data.updatedAt || new Date(),
    })),
    save: jest.fn(async (input: any) => {
      if (Array.isArray(input)) {
        for (const item of input) {
          const idx = notifications.findIndex((n) => n.id === item.id);
          if (idx >= 0) {
            notifications[idx] = { ...notifications[idx], ...item };
          } else {
            notifications.push(item);
          }
        }
        return input;
      }

      const idx = notifications.findIndex((n) => n.id === input.id);
      if (idx >= 0) {
        notifications[idx] = { ...notifications[idx], ...input };
      } else {
        notifications.push(input);
      }
      return input;
    }),
  };

  const preferencesRepository = {
    findOne: jest.fn(async ({ where }: { where: { userId: string } }) => {
      return preferences.get(where.userId) || null;
    }),
    create: jest.fn((data: Partial<NotificationPreferencesEntity>) => ({
      id: `pref-${Date.now()}`,
      userId: data.userId,
      preferences: {},
      emailEnabled: true,
      inAppEnabled: true,
      pushEnabled: false,
      allowPromotionalEmail: true,
      allowOrderSms: true,
      allowInAppAlerts: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
    save: jest.fn(async (pref: NotificationPreferencesEntity) => {
      preferences.set(pref.userId, pref);
      return pref;
    }),
  };

  const userRepository = {
    findOne: jest.fn(async ({ where }: { where: { id: string | number } }) => {
      return users.get(String(where.id)) || null;
    }),
  };

  const waitFor = async (
    predicate: () => boolean,
    attempts = 60,
    delayMs = 10,
  ): Promise<void> => {
    for (let i = 0; i < attempts; i++) {
      if (predicate()) return;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    throw new Error('Condition not met within timeout');
  };

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot()],
      providers: [
        NotificationsService,
        NotificationEventListener,
        {
          provide: getRepositoryToken(NotificationEntity),
          useValue: notificationRepository,
        },
        {
          provide: getRepositoryToken(NotificationPreferencesEntity),
          useValue: preferencesRepository,
        },
        {
          provide: getRepositoryToken(Users),
          useValue: userRepository,
        },
        { provide: getQueueToken(EMAIL_QUEUE), useValue: emailQueue },
        { provide: NotificationGateway, useValue: notificationGateway },
        { provide: I18nService, useValue: i18nService },
        { provide: RetryStrategyService, useValue: retryStrategy },
        { provide: DeadLetterQueueService, useValue: deadLetterQueueService },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    eventEmitter = moduleRef.get(EventEmitter2);
  });

  afterAll(async () => {
    await app.close();
    await moduleRef.close();
  });

  beforeEach(() => {
    notifications.length = 0;
    preferences.clear();
    users.clear();
    seq = 1;
    jest.clearAllMocks();

    users.set('101', {
      id: 101,
      email: 'buyer@test.com',
      name: 'Buyer One',
    });
  });

  it('creates and dispatches in-app notifications from order.created event', async () => {
    preferences.set('101', {
      id: 'pref-101',
      userId: '101',
      preferences: {
        [NotificationType.ORDER_CREATED]: [NotificationChannel.IN_APP],
      } as any,
      emailEnabled: true,
      inAppEnabled: true,
      pushEnabled: false,
      allowPromotionalEmail: true,
      allowOrderSms: true,
      allowInAppAlerts: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    eventEmitter.emit(EventNames.ORDER_CREATED, {
      orderId: 'o-1',
      userId: '101',
      orderNumber: 'ORD-1',
      totalAmount: 99,
      items: [],
    });

    await waitFor(() => notifications.length === 1);
    await waitFor(() => notifications[0].status === NotificationStatus.SENT);

    expect(notifications[0].channel).toBe(NotificationChannel.IN_APP);
    expect(notificationGateway.sendNotification).toHaveBeenCalledTimes(1);
    expect(emailQueue.add).not.toHaveBeenCalled();
  });

  it('queues email notifications when email channel is preferred', async () => {
    preferences.set('101', {
      id: 'pref-101',
      userId: '101',
      preferences: {
        [NotificationType.ORDER_CREATED]: [NotificationChannel.EMAIL],
      } as any,
      emailEnabled: true,
      inAppEnabled: true,
      pushEnabled: false,
      allowPromotionalEmail: true,
      allowOrderSms: true,
      allowInAppAlerts: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    eventEmitter.emit(EventNames.ORDER_CREATED, {
      orderId: 'o-2',
      userId: '101',
      orderNumber: 'ORD-2',
      totalAmount: 12,
      items: [{ sku: 'x' }],
    });

    await waitFor(() => notifications.length === 1);
    await waitFor(() => notifications[0].status === NotificationStatus.SENT);

    expect(notifications[0].channel).toBe(NotificationChannel.EMAIL);
    expect(emailQueue.add).toHaveBeenCalledTimes(1);
    expect(emailQueue.add).toHaveBeenCalledWith(
      'send-email',
      expect.objectContaining({ to: 'buyer@test.com' }),
    );
    expect(notificationGateway.sendNotification).not.toHaveBeenCalled();
  });

  it('filters notifications out when preferred channels are disabled', async () => {
    preferences.set('101', {
      id: 'pref-101',
      userId: '101',
      preferences: {
        [NotificationType.ORDER_CREATED]: [NotificationChannel.EMAIL],
      } as any,
      emailEnabled: false,
      inAppEnabled: false,
      pushEnabled: false,
      allowPromotionalEmail: true,
      allowOrderSms: true,
      allowInAppAlerts: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    eventEmitter.emit(EventNames.ORDER_CREATED, {
      orderId: 'o-3',
      userId: '101',
      orderNumber: 'ORD-3',
      totalAmount: 77,
      items: [],
    });

    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(notifications).toHaveLength(0);
    expect(emailQueue.add).not.toHaveBeenCalled();
    expect(notificationGateway.sendNotification).not.toHaveBeenCalled();
  });
});
