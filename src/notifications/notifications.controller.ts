import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Body,
  ParseIntPipe,
  Query,
  ParseBoolPipe,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { Notification } from './notification.entity';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * GET /notifications
   * Retrieve all notifications for the authenticated user
   * @query isRead - Optional filter to get only read or unread notifications
   */
  @Get()
  async findAll(
    @Query('isRead', new ParseBoolPipe({ optional: true }))
    isRead?: boolean,
  ): Promise<Notification[]> {
    // In a real implementation, get recipientId from authenticated user context
    const recipientId = ''; // This should come from request context/JWT
    return this.notificationsService.findAllForUser(recipientId, isRead);
  }

  /**
   * GET /notifications/unread-count
   * Get the count of unread notifications
   */
  @Get('unread-count')
  async getUnreadCount(): Promise<{ unreadCount: number }> {
    // In a real implementation, get recipientId from authenticated user context
    const recipientId = '';
    const unreadCount =
      await this.notificationsService.getUnreadCount(recipientId);
    return { unreadCount };
  }

  /**
   * GET /notifications/:id
   * Retrieve a specific notification by ID
   */
  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<Notification> {
    return this.notificationsService.findOne(id);
  }

  /**
   * POST /notifications
   * Create a new notification (typically called by internal services)
   */
  @Post()
  async create(
    @Body() createNotificationDto: CreateNotificationDto,
  ): Promise<Notification> {
    // In a real implementation, get recipientId from request or body
    const recipientId = ''; // This should come from authenticated context or request body
    return this.notificationsService.create(recipientId, createNotificationDto);
  }

  /**
   * PATCH /notifications/:id/read
   * Mark a specific notification as read
   */
  @Patch(':id/read')
  async markRead(@Param('id', ParseIntPipe) id: number): Promise<Notification> {
    return this.notificationsService.markRead(id);
  }

  /**
   * PATCH /notifications/read-all
   * Mark all notifications for the user as read
   */
  @Patch('read-all')
  async markAllRead(): Promise<{ affected: number }> {
    // In a real implementation, get recipientId from authenticated user context
    const recipientId = '';
    return this.notificationsService.markAllRead(recipientId);
  }
}
