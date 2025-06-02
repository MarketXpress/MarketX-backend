import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions, Between, In } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { NotificationEntity, NotificationType, NotificationChannel, NotificationPriority } from './notification.entity';
import { CreateNotificationDto, UpdateNotificationDto, NotificationQueryDto } from './dto/notification.dto';

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
    private notificationRepository: Repository<NotificationEntity>,
    private eventEmitter: EventEmitter2,
  ) {}

  /**
   * Create and store a new notification
   */
  async createNotification(createNotificationDto: CreateNotificationDto): Promise<NotificationEntity> {
    try {
      const notification = this.notificationRepository.create({
        ...createNotificationDto,
        createdAt: new Date(),
      });

      const savedNotification = await this.notificationRepository.save(notification);

      // Emit event for real-time notification delivery
      this.eventEmitter.emit('notification.created', savedNotification);

      this.logger.log(`Notification created for user ${savedNotification.userId}: ${savedNotification.title}`);
      
      return savedNotification;
    } catch (error) {
      this.logger.error('Failed to create notification', error);
      throw error;
    }
  }

  /**
   * Send notification for transaction received event
   */
  async sendTransactionReceivedNotification(
    userId: string,
    transactionId: string,
    amount: number,
    currency: string = 'USD'
  ): Promise<NotificationEntity> {
    const notification = await this.createNotification({
      userId,
      title: 'Transaction Received',
      message: `You received ${currency} ${amount.toFixed(2)}`,
      type: NotificationType.TRANSACTION_RECEIVED,
      channel: NotificationChannel.IN_APP,
      priority: NotificationPriority.HIGH,
      relatedEntityId: transactionId,
      relatedEntityType: 'transaction',
      metadata: {
        amount,
        currency,
        transactionId,
      },
    });

    // Also send push notification for high priority
    this.eventEmitter.emit('notification.send_push', {
      userId,
      title: notification.title,
      message: notification.message,
      data: { notificationId: notification.id, transactionId },
    });

    return notification;
  }

  /**
   * Get notifications for a specific user with filtering and pagination
   */
  async getUserNotifications(
    userId: string,
    queryDto: NotificationQueryDto
  ): Promise<{ notifications: NotificationEntity[]; total: number; unreadCount: number }> {
    const {
      page = 1,
      limit = 20,
      read,
      type,
      priority,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = queryDto;

    const whereConditions: any = { userId };

    if (read !== undefined) {
      whereConditions.read = read;
    }

    if (type) {
      whereConditions.type = type;
    }

    if (priority) {
      whereConditions.priority = priority;
    }

    if (startDate && endDate) {
      whereConditions.createdAt = Between(new Date(startDate), new Date(endDate));
    }

    const options: FindManyOptions<NotificationEntity> = {
      where: whereConditions,
      order: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    };

    const [notifications, total] = await this.notificationRepository.findAndCount(options);

    // Get unread count
    const unreadCount = await this.notificationRepository.count({
      where: { userId, read: false },
    });

    return { notifications, total, unreadCount };
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<NotificationEntity> {
    const notification = await this.notificationRepository.findOne({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (!notification.read) {
      notification.read = true;
      notification.readAt = new Date();
      await this.notificationRepository.save(notification);

      this.eventEmitter.emit('notification.read', notification);
    }

    return notification;
  }

  /**
   * Mark multiple notifications as read
   */
  async markMultipleAsRead(notificationIds: string[], userId: string): Promise<void> {
    await this.notificationRepository.update(
      { id: In(notificationIds), userId, read: false },
      { read: true, readAt: new Date() }
    );

    this.logger.log(`Marked ${notificationIds.length} notifications as read for user ${userId}`);
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationRepository.update(
      { userId, read: false },
      { read: true, readAt: new Date() }
    );

    this.logger.log(`Marked all notifications as read for user ${userId}`);
  }

  /**
   * Delete a notification
   */
  async deleteNotification(notificationId: string, userId: string): Promise<void> {
    const result = await this.notificationRepository.delete({
      id: notificationId,
      userId,
    });

    if (result.affected === 0) {
      throw new NotFoundException('Notification not found');
    }

    this.logger.log(`Deleted notification ${notificationId} for user ${userId}`);
  }

  /**
   * Delete multiple notifications
   */
  async deleteMultipleNotifications(notificationIds: string[], userId: string): Promise<void> {
    await this.notificationRepository.delete({
      id: In(notificationIds),
      userId,
    });

    this.logger.log(`Deleted ${notificationIds.length} notifications for user ${userId}`);
  }

  /**
   * Get notification statistics for a user
   */
  async getUserNotificationStats(userId: string): Promise<NotificationStats> {
    const notifications = await this.notificationRepository.find({
      where: { userId },
      select: ['read', 'type', 'priority'],
    });

    const total = notifications.length;
    const unread = notifications.filter(n => !n.read).length;
    const read = total - unread;

    const byType = notifications.reduce((acc, notification) => {
      acc[notification.type] = (acc[notification.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byPriority = notifications.reduce((acc, notification) => {
      acc[notification.priority] = (acc[notification.priority] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return { total, unread, read, byType, byPriority };
  }

  /**
   * Get a single notification by ID
   */
  async getNotificationById(notificationId: string, userId: string): Promise<NotificationEntity> {
    const notification = await this.notificationRepository.findOne({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return notification;
  }

  /**
   * Update notification
   */
  async updateNotification(
    notificationId: string,
    userId: string,
    updateDto: UpdateNotificationDto
  ): Promise<NotificationEntity> {
    const notification = await this.getNotificationById(notificationId, userId);
    
    Object.assign(notification, updateDto);
    return await this.notificationRepository.save(notification);
  }

  /**
   * Clean up expired notifications
   */
  async cleanupExpiredNotifications(): Promise<number> {
    const result = await this.notificationRepository.delete({
      expiresAt: Between(new Date('1970-01-01'), new Date()),
    });

    const deletedCount = result.affected || 0;
    this.logger.log(`Cleaned up ${deletedCount} expired notifications`);
    
    return deletedCount;
  }

  /**
   * Send bulk notifications
   */
  async sendBulkNotifications(notifications: CreateNotificationDto[]): Promise<NotificationEntity[]> {
    const createdNotifications = await this.notificationRepository.save(
      this.notificationRepository.create(notifications)
    );

    // Emit events for each notification
    createdNotifications.forEach(notification => {
      this.eventEmitter.emit('notification.created', notification);
    });

    this.logger.log(`Created ${createdNotifications.length} bulk notifications`);
    
    return createdNotifications;
  }
}