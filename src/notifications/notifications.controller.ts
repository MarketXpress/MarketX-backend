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
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * GET /notifications
   * Retrieve all notifications for the authenticated user
   * @query isRead - Optional filter to get only read or unread notifications
   */
  @Get()
  @ApiOperation({ summary: 'List notifications' })
  @ApiResponse({ status: 200, description: 'Notifications returned.' })
  async findAll(
    @Query('isRead', new ParseBoolPipe({ optional: true }))
    isRead?: boolean,
  ): Promise<Notification[]> {
    // In a real implementation, get recipientId from authenticated user context
    const recipientId = 0; // This should come from request context/JWT
    return this.notificationsService.findAllForUser(recipientId, isRead);
  }

  /**
   * GET /notifications/unread-count
   * Get the count of unread notifications
   */
  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count' })
  @ApiResponse({ status: 200, description: 'Unread count returned.' })
  async getUnreadCount(): Promise<{ unreadCount: number }> {
    // In a real implementation, get recipientId from authenticated user context
    const recipientId = 0;
    const unreadCount =
      await this.notificationsService.getUnreadCount(recipientId);
    return { unreadCount };
  }

  /**
   * GET /notifications/:id
   * Retrieve a specific notification by ID
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get a notification by ID' })
  @ApiResponse({ status: 200, description: 'Notification returned.' })
  @ApiResponse({ status: 404, description: 'Notification not found.' })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<Notification> {
    return this.notificationsService.findOne(id);
  }

  /**
   * POST /notifications
   * Create a new notification (typically called by internal services)
   */
  @Post()
  @ApiOperation({ summary: 'Create a notification' })
  @ApiResponse({ status: 201, description: 'Notification created.' })
  async create(
    @Body() createNotificationDto: CreateNotificationDto,
  ): Promise<Notification> {
    // In a real implementation, get recipientId from request or body
    const recipientId = 0; // This should come from authenticated context or request body
    return this.notificationsService.create(recipientId, createNotificationDto);
  }

  /**
   * PATCH /notifications/:id/read
   * Mark a specific notification as read
   */
  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  @ApiResponse({ status: 200, description: 'Notification marked as read.' })
  async markRead(@Param('id', ParseIntPipe) id: number): Promise<Notification> {
    return this.notificationsService.markRead(id);
  }

  /**
   * PATCH /notifications/read-all
   * Mark all notifications for the user as read
   */
  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiResponse({ status: 200, description: 'Notifications marked as read.' })
  async markAllRead(): Promise<{ affected: number }> {
    // In a real implementation, get recipientId from authenticated user context
    const recipientId = 0;
    return this.notificationsService.markAllRead(recipientId);
  }
}
