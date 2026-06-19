import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationType } from './notification.entity';
import { CreateNotificationDto } from './dto/create-notification.dto';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
  ) {}

  /**
   * Create a new notification for a user
   */
  async create(
    recipientId: string,
    createNotificationDto: CreateNotificationDto,
  ): Promise<Notification> {
    const notification = this.notificationRepository.create({
      recipientId,
      ...createNotificationDto,
    });
    return await this.notificationRepository.save(notification);
  }

  /**
   * Find all notifications for a specific user, optionally filtered by read status
   */
  async findAllForUser(
    recipientId: string,
    isRead?: boolean,
  ): Promise<Notification[]> {
    const query = this.notificationRepository.createQueryBuilder('n');
    query.where('n.recipientId = :recipientId', { recipientId });

    if (isRead !== undefined) {
      query.andWhere('n.isRead = :isRead', { isRead });
    }

    query.orderBy('n.createdAt', 'DESC');
    return await query.getMany();
  }

  /**
   * Find a single notification by ID
   */
  async findOne(id: number): Promise<Notification> {
    const notification = await this.notificationRepository.findOne({
      where: { id },
    });

    if (!notification) {
      throw new NotFoundException(`Notification with ID ${id} not found`);
    }

    return notification;
  }

  /**
   * Mark a single notification as read
   */
  async markRead(id: number): Promise<Notification> {
    const notification = await this.findOne(id);

    if (!notification.isRead) {
      notification.isRead = true;
      notification.readAt = new Date();
      return await this.notificationRepository.save(notification);
    }

    return notification;
  }

  /**
   * Mark all notifications for a user as read
   */
  async markAllRead(recipientId: string): Promise<{ affected: number }> {
    const result = await this.notificationRepository.update(
      { recipientId, isRead: false },
      { isRead: true, readAt: new Date() },
    );

    return { affected: result.affected || 0 };
  }

  /**
   * Delete a notification by ID
   */
  async remove(id: number): Promise<void> {
    const result = await this.notificationRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Notification with ID ${id} not found`);
    }
  }

  /**
   * Delete all notifications for a user
   */
  async removeAllForUser(recipientId: string): Promise<{ affected: number }> {
    const result = await this.notificationRepository.delete({ recipientId });
    return { affected: result.affected || 0 };
  }

  /**
   * Get unread notification count for a user
   */
  async getUnreadCount(recipientId: string): Promise<number> {
    return await this.notificationRepository.countBy({
      recipientId,
      isRead: false,
    });
  }
}
