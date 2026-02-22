import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions, Between, In, UpdateResult } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  NotificationEntity,
  NotificationType,
  NotificationChannel,
  NotificationPriority,
  NotificationStatus,
} from './notification.entity'; 
import { NotificationPreferencesEntity } from './notification-preferences.entity'; 
import { Users } from '../users/users.entity';
import { I18nService } from '../i18n/i18n.service';


import {
  CreateNotificationDto as CreateNotificationDtoV1,
  UpdateNotificationDto,
  NotificationQueryDto,
} from './dto/notification.dto';
import { CreateNotificationDto as CreateNotificationDtoV2 } from './dto/create-notification.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { QueryNotificationsDto } from './dto/query-notifications.dto';

// Cache manager service used in first file
import { CacheManagerService } from '../cache/cache-manager.service';

// unify CreateNotificationDto type (accept either shape)
type CreateNotificationDto = CreateNotificationDtoV1 | CreateNotificationDtoV2;
type GetNotificationsQuery = NotificationQueryDto | QueryNotificationsDto;

export interface NotificationStats {
  total: number;
  unread: number;
  read: number;
  byType: Record<string, number>;
  byPriority: Record<string, number>;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(NotificationEntity)
    private readonly notificationRepository: Repository<NotificationEntity>,

    // preferences repository (from second implementation)
    @InjectRepository(NotificationPreferencesEntity)
    private readonly preferencesRepository: Repository<NotificationPreferencesEntity>,

    @InjectRepository(Users)
    private readonly usersRepository: Repository<Users>,

    private readonly eventEmitter: EventEmitter2,
    private readonly i18nService: I18nService,
    private readonly cacheManager?: CacheManagerService, // optional - if not provided adapt accordingly
  ) {}

  /**
   * Get or create default preferences for a user
   */
  async getUserPreferences(userId: string): Promise<NotificationPreferencesEntity> {
    let preferences = await this.preferencesRepository.findOne({ where: { userId } });

    if (!preferences) {
      preferences = this.preferencesRepository.create({ userId });
      await this.preferencesRepository.save(preferences);
    }

    return preferences;
  }

  /**
   * Update preferences
   */
  async updateUserPreferences(userId: string, dto: UpdatePreferencesDto): Promise<NotificationPreferencesEntity> {
    const preferences = await this.getUserPreferences(userId);

    if (dto.preferences) preferences.preferences = dto.preferences;
    if (dto.emailEnabled !== undefined) preferences.emailEnabled = dto.emailEnabled;
    if (dto.inAppEnabled !== undefined) preferences.inAppEnabled = dto.inAppEnabled;
    if (dto.pushEnabled !== undefined) preferences.pushEnabled = dto.pushEnabled;

    return this.preferencesRepository.save(preferences);
  }

  /**
   * Create a notification (respects user preferences, creates per-channel notifications and processes them)
   */
  async createNotification(dto: CreateNotificationDto): Promise<NotificationEntity[] | NotificationEntity> {
    try {
      // Attempt to get preferences and determine enabled channels
      const preferences = await this.getUserPreferences((dto as any).userId);
      const preferredChannels: NotificationChannel[] =
        (preferences.preferences && preferences.preferences[(dto as any).type]) || [];

      // If DTO already specifies channel(s), prefer that
      const requestedChannel = (dto as any).channel;
      const channelsToCreate: NotificationChannel[] = requestedChannel
        ? Array.isArray(requestedChannel)
          ? requestedChannel
          : [requestedChannel]
        : preferredChannels.length > 0
        ? preferredChannels
        : [NotificationChannel.IN_APP]; // default to IN_APP when nothing configured

      const notificationsToSave: NotificationEntity[] = [];

      for (const channel of channelsToCreate) {
        // Respect global channel toggles
        if (channel === NotificationChannel.EMAIL && !preferences.emailEnabled) continue;
        if (channel === NotificationChannel.IN_APP && !preferences.inAppEnabled) continue;
        if (channel === NotificationChannel.PUSH && !preferences.pushEnabled) continue;

        const notification = this.notificationRepository.create({
          ...(dto as any),
          channel,
          status: NotificationStatus.PENDING,
          createdAt: (dto as any).createdAt ? new Date((dto as any).createdAt) : new Date(),
        } as Partial<NotificationEntity>);

        notificationsToSave.push(notification);
      }

      if (notificationsToSave.length === 0) {
        this.logger.log(`No notifications created for user ${(dto as any).userId} due to preferences.`);
        return [];
      }

      const saved = await this.notificationRepository.save(notificationsToSave);

      // Emit created events & process each notification (async but not backgrounded by the assistant — we trigger here)
      for (const notification of saved) {
        this.eventEmitter.emit('notification.created', notification);
        // process but don't block the save. We catch errors to prevent unhandled rejections.
        this.processNotification(notification).catch((err) => {
          this.logger.error(`Error processing notification ${notification.id}:`, err);
        });
      }

      // Invalidate caches related to the user
      if (this.cacheManager && saved[0]) {
        await this.cacheManager.invalidatePattern(`user:${saved[0].userId}:notifications:*`);
        await this.cacheManager.invalidatePattern(`user:${saved[0].userId}:notifications:unread-count`);
      }

      // if single channel created, return that; otherwise return list
      return saved.length === 1 ? saved[0] : saved;
    } catch (error) {
      this.logger.error('Failed to create notification:', error);
      throw error;
    }
  }

  /**
   * Process one notification (send via appropriate channel)
   */
  private async processNotification(notification: NotificationEntity): Promise<void> {
    try {
      switch (notification.channel) {
        case NotificationChannel.EMAIL:
          await this.sendEmailNotification(notification);
          break;
        case NotificationChannel.IN_APP:
          await this.sendInAppNotification(notification);
          break;
        case NotificationChannel.PUSH:
          await this.sendPushNotification(notification);
          break;
        default:
          this.logger.warn(`Unknown notification channel for ${notification.id}: ${notification.channel}`);
      }

      notification.status = NotificationStatus.SENT;
      notification.sentAt = new Date();
      await this.notificationRepository.save(notification);
    } catch (error) {
      this.logger.error(`Failed to send ${notification.channel} notification:`, error);
      notification.status = NotificationStatus.FAILED;
      try {
        await this.notificationRepository.save(notification);
      } catch (saveErr) {
        this.logger.error('Failed to save failed notification status:', saveErr);
      }
    }
  }

  private async sendEmailNotification(notification: NotificationEntity): Promise<void> {
    const preferredLanguage = await this.getUserLanguage(notification.userId);
    const localizedTitle = await this.i18nService.translate('emails.transaction_received.title', {
      lang: preferredLanguage,
      args: notification.metadata || {},
    });
    const localizedMessage = await this.i18nService.translate('emails.transaction_received.message', {
      lang: preferredLanguage,
      args: notification.metadata || {},
    });

    // TODO: integrate real email provider (SendGrid/SES/etc)
    this.logger.log(`(EMAIL) To user ${notification.userId}: ${localizedTitle}`);
    // Optionally emit event for external worker
    this.eventEmitter.emit('notification.send_email', {
      ...notification,
      title: localizedTitle,
      message: localizedMessage,
      language: preferredLanguage,
    });
  }

  private async getUserLanguage(userId: string): Promise<string> {
    const numericUserId = Number(userId);
    if (Number.isNaN(numericUserId)) {
      return 'en';
    }

    const user = await this.usersRepository.findOne({
      where: { id: numericUserId },
      select: ['language'],
    });

    return user?.language || 'en';
  }

  private async sendInAppNotification(notification: NotificationEntity): Promise<void> {
    // In-app items are already persisted to DB; emit for realtime delivery (websockets)
    this.eventEmitter.emit('notification.in-app', { userId: notification.userId, notification });
    this.logger.log(`In-app notification created for user ${notification.userId}`);
  }

  private async sendPushNotification(notification: NotificationEntity): Promise<void> {
    // TODO: integrate with FCM/APNs
    this.logger.log(`(PUSH) To user ${notification.userId}: ${notification.title}`);
    this.eventEmitter.emit('notification.send_push', {
      userId: notification.userId,
      title: notification.title,
      message: notification.message,
      data: { notificationId: notification.id, relatedEntityId: (notification as any).relatedEntityId },
    });
  }

  /**
   * Shortcut: create a transaction received notification (keeps existing API)
   */
  async sendTransactionReceivedNotification(
    userId: string,
    transactionId: string,
    amount: number,
    currency = 'USD',
  ): Promise<NotificationEntity | NotificationEntity[]> {
    const preferredLanguage = await this.getUserLanguage(userId);
    const title = await this.i18nService.translate('emails.transaction_received.title', {
      lang: preferredLanguage,
      args: { amount: amount.toFixed(2), currency },
    });
    const message = await this.i18nService.translate('emails.transaction_received.message', {
      lang: preferredLanguage,
      args: { amount: amount.toFixed(2), currency },
    });

    const dto: Partial<CreateNotificationDto> = {
      userId,
      title,
      message,
      type: NotificationType.TRANSACTION_RECEIVED,
      channel: NotificationChannel.IN_APP,
      priority: NotificationPriority.HIGH,
      relatedEntityId: transactionId,
      relatedEntityType: 'transaction',
      metadata: { amount: amount.toFixed(2), currency, transactionId },
    } as any;

    const created = await this.createNotification(dto as CreateNotificationDto);

    // Also emit push send event for high priority (duplicate-safe)
    if (Array.isArray(created)) {
      created.forEach((c) =>
        this.eventEmitter.emit('notification.send_push', {
          userId,
          title: c.title,
          message: c.message,
          data: { notificationId: c.id, transactionId },
        }),
      );
    } else if (created) {
      this.eventEmitter.emit('notification.send_push', {
        userId,
        title: (created as NotificationEntity).title,
        message: (created as NotificationEntity).message,
        data: { notificationId: (created as NotificationEntity).id, transactionId },
      });
    }

    return created as NotificationEntity | NotificationEntity[];
  }

  /**
   * Get user notifications (supports both DTO shapes and fallbacks)
   */
  async getUserNotifications(userId: string, queryDto: GetNotificationsQuery) {
    // Normalize common params
    const page = (queryDto as any).page ?? 1;
    const limit = (queryDto as any).limit ?? 20;
    const type = (queryDto as any).type ?? (queryDto as any).notificationType;
    const status = (queryDto as any).status;
    const isRead = (queryDto as any).isRead ?? (queryDto as any).read;
    const sortBy = (queryDto as any).sortBy ?? 'createdAt';
    const sortOrder = ((queryDto as any).sortOrder ?? 'DESC') as 'ASC' | 'DESC';

    // If user requested only IN_APP channel, use queryBuilder and filters
    const qb = this.notificationRepository.createQueryBuilder('notification');
    qb.where('notification.userId = :userId', { userId });

    // If DTO specified channel filtering include it (default to IN_APP for listing in-app)
    if ((queryDto as any).channel) {
      qb.andWhere('notification.channel = :channel', { channel: (queryDto as any).channel });
    } else {
      // default to in-app for user-facing listing
      qb.andWhere('notification.channel = :channel', { channel: NotificationChannel.IN_APP });
    }

    if (type) qb.andWhere('notification.type = :type', { type });
    if (status) qb.andWhere('notification.status = :status', { status });
    if (isRead !== undefined) qb.andWhere('notification.isRead = :isRead OR notification.read = :isRead', { isRead });

    const [items, total] = await qb
      .orderBy(`notification.${sortBy}`, sortOrder)
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * A cached finder used by frontends (keeps first file API)
   */
  async findUserNotifications(userId: string, page = 1, limit = 20) {
    if (!this.cacheManager) {
      // fallback to direct DB query
      return this.notificationRepository.find({
        where: { userId },
        order: { createdAt: 'DESC' as 'DESC' },
        skip: (page - 1) * limit,
        take: limit,
      });
    }

    return this.cacheManager.getOrSet(
      `user:${userId}:notifications:page:${page}:limit:${limit}`,
      async () => {
        return this.notificationRepository.find({
          where: { userId },
          order: { createdAt: 'DESC' as 'DESC' },
          skip: (page - 1) * limit,
          take: limit,
        });
      },
      { ttl: 300, tags: ['notifications', `user:${userId}`] },
    );
  }

  /**
   * Unread count with caching
   */
  async getUnreadCount(userId: string): Promise<number> {
    if (!this.cacheManager) {
      return this.notificationRepository.count({ where: { userId, isRead: false, channel: NotificationChannel.IN_APP } });
    }

    return this.cacheManager.getOrSet(
      `user:${userId}:notifications:unread-count`,
      async () => {
        return this.notificationRepository.count({
          where: { userId, isRead: false, channel: NotificationChannel.IN_APP },
        });
      },
      { ttl: 120, tags: ['notifications', `user:${userId}`, 'counts'] },
    );
  }

  /**
   * Mark a single notification as read (works with read or isRead fields)
   */
  async markAsRead(userId: string, notificationId: string): Promise<NotificationEntity> {
    const notification = await this.notificationRepository.findOne({ where: { id: notificationId, userId } });

    if (!notification) throw new NotFoundException('Notification not found');

    // Support both schema variants
    if ((notification as any).isRead === false || (notification as any).read === false) {
      (notification as any).isRead = true;
      (notification as any).read = true;
      (notification as any).readAt = new Date();
      await this.notificationRepository.save(notification);

      // emit event and invalidate cache
      this.eventEmitter.emit('notification.read', notification);
      if (this.cacheManager) {
        await this.cacheManager.invalidatePattern(`user:${userId}:notifications:*`);
        await this.cacheManager.invalidatePattern(`user:${userId}:notifications:unread-count`);
      }
    }

    return notification;
  }

  /**
   * Mark multiple notifications as read in DB
   */
  async markMultipleAsRead(notificationIds: string[], userId: string): Promise<UpdateResult> {
    const res = await this.notificationRepository.update(
      { id: In(notificationIds), userId, read: false },
      { read: true, isRead: true, readAt: new Date() } as any,
    );

    this.logger.log(`Marked ${notificationIds.length} notifications as read for user ${userId}`);

    if (this.cacheManager) {
      await this.cacheManager.invalidatePattern(`user:${userId}:notifications:*`);
      await this.cacheManager.invalidatePattern(`user:${userId}:notifications:unread-count`);
    }

    return res;
  }

  /**
   * Mark all unread as read (DB)
   */
  async markAllAsReadInDb(userId: string): Promise<void> {
    await this.notificationRepository
      .createQueryBuilder()
      .update(NotificationEntity)
      .set({ read: true, isRead: true, readAt: new Date() } as any)
      .where('userId = :userId', { userId })
      .andWhere('(isRead = :isRead OR read = :isRead)', { isRead: false })
      .execute();

    this.logger.log(`Marked all notifications as read for user ${userId}`);

    if (this.cacheManager) {
      await this.cacheManager.invalidatePattern(`user:${userId}:notifications:*`);
      await this.cacheManager.invalidatePattern(`user:${userId}:notifications:unread-count`);
    }
  }

  /**
   * Cached helper that marks a notification as read (high-level)
   */
  async markAsReadCached(userId: string, notificationId: string) {
    await this.markAsRead(userId, notificationId);

    if (this.cacheManager) {
      await this.cacheManager.invalidatePattern(`user:${userId}:notifications:*`);
    }

    return { message: 'Notification marked as read' };
  }

  /**
   * Mark all as read with cache invalidation
   */
  async markAllAsRead(userId: string) {
    await this.markAllAsReadInDb(userId);

    if (this.cacheManager) {
      await this.cacheManager.invalidatePattern(`user:${userId}:notifications:*`);
    }

    return { message: 'All notifications marked as read' };
  }

  /**
   * Get a single notification
   */
  async getNotificationById(notificationId: string, userId: string): Promise<NotificationEntity> {
    const notification = await this.notificationRepository.findOne({ where: { id: notificationId, userId } });

    if (!notification) throw new NotFoundException('Notification not found');

    return notification;
  }

  /**
   * Update notification (partial)
   */
  async updateNotification(notificationId: string, userId: string, updateDto: UpdateNotificationDto) {
    const notification = await this.getNotificationById(notificationId, userId);

    Object.assign(notification, updateDto);
    const saved = await this.notificationRepository.save(notification);

    if (this.cacheManager) await this.cacheManager.invalidatePattern(`user:${userId}:notifications:*`);

    return saved;
  }

  /**
   * Delete single notification
   */
  async deleteNotification(notificationId: string, userId: string): Promise<void> {
    const result = await this.notificationRepository.delete({ id: notificationId, userId });
    if ((result as any).affected === 0) throw new NotFoundException('Notification not found');

    this.logger.log(`Deleted notification ${notificationId} for user ${userId}`);
    if (this.cacheManager) await this.cacheManager.invalidatePattern(`user:${userId}:notifications:*`);
  }

  /**
   * Delete multiple notifications
   */
  async deleteMultipleNotifications(notificationIds: string[], userId: string): Promise<void> {
    await this.notificationRepository.delete({ id: In(notificationIds), userId });
    this.logger.log(`Deleted ${notificationIds.length} notifications for user ${userId}`);
    if (this.cacheManager) await this.cacheManager.invalidatePattern(`user:${userId}:notifications:*`);
  }

  /**
   * Send bulk notifications
   */
  async sendBulkNotifications(notifications: CreateNotificationDto[]): Promise<NotificationEntity[]> {
    const created = await this.notificationRepository.save(this.notificationRepository.create(notifications as any));
    created.forEach((n) => this.eventEmitter.emit('notification.created', n));

    // Process each notification (fire-and-forget)
    created.forEach((n) =>
      this.processNotification(n).catch((err) => this.logger.error(`Failed processing bulk notification ${n.id}:`, err)),
    );

    // Invalidate caches per user (simple implementation)
    if (this.cacheManager) {
      const uniqueUsers = Array.from(new Set(created.map((c) => c.userId)));
      await Promise.all(uniqueUsers.map((u) => this.cacheManager.invalidatePattern(`user:${u}:notifications:*`)));
    }

    this.logger.log(`Created ${created.length} bulk notifications`);
    return created;
  }

  /**
   * Get notification statistics for a user
   */
  async getUserNotificationStats(userId: string): Promise<NotificationStats> {
    const notifications = await this.notificationRepository.find({
      where: { userId },
      select: ['read', 'isRead', 'type', 'priority'],
    } as any);

    const total = notifications.length;
    const unread = notifications.filter((n: any) => !(n.isRead ?? n.read)).length;
    const read = total - unread;

    const byType = notifications.reduce((acc, n: any) => {
      const t = n.type || 'unknown';
      acc[t] = (acc[t] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byPriority = notifications.reduce((acc, n: any) => {
      const p = n.priority || 'normal';
      acc[p] = (acc[p] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return { total, unread, read, byType, byPriority };
  }

  /**
   * Cleanup expired notifications (where expiresAt is in the past)
   */
  async cleanupExpiredNotifications(): Promise<number> {
    const now = new Date();
    const result = await this.notificationRepository
      .createQueryBuilder()
      .delete()
      .from(NotificationEntity)
      .where('expiresAt IS NOT NULL')
      .andWhere('expiresAt < :now', { now })
      .execute();

    const deletedCount = (result as any).affected || 0;
    this.logger.log(`Cleaned up ${deletedCount} expired notifications`);
    return deletedCount;
  }
}
