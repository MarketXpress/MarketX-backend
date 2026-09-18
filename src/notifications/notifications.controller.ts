import {
  Body,
  Controller,
  Get,
  Param,
  ParseBoolPipe,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { Notification } from './notification.entity';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

interface AuthenticatedNotificationUser {
  id?: unknown;
}

function getRecipientId(user: AuthenticatedNotificationUser): number {
  const recipientId = user?.id;

  if (
    typeof recipientId !== 'number' ||
    !Number.isSafeInteger(recipientId) ||
    recipientId <= 0
  ) {
    throw new UnauthorizedException('Invalid authenticated user context');
  }

  return recipientId;
}

@ApiTags('Notifications')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Authentication required.' })
@UseGuards(JwtAuthGuard)
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
    @CurrentUser() user: AuthenticatedNotificationUser,
    @Query('isRead', new ParseBoolPipe({ optional: true }))
    isRead?: boolean,
  ): Promise<Notification[]> {
    return this.notificationsService.findAllForUser(
      getRecipientId(user),
      isRead,
    );
  }

  /**
   * GET /notifications/unread-count
   * Get the count of unread notifications
   */
  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count' })
  @ApiResponse({ status: 200, description: 'Unread count returned.' })
  async getUnreadCount(
    @CurrentUser() user: AuthenticatedNotificationUser,
  ): Promise<{ unreadCount: number }> {
    const unreadCount = await this.notificationsService.getUnreadCount(
      getRecipientId(user),
    );
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
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedNotificationUser,
  ): Promise<Notification> {
    return this.notificationsService.findOne(id, getRecipientId(user));
  }

  /**
   * POST /notifications
   * Create a notification owned by the authenticated user.
   * Internal services that need to select a recipient require a separate,
   * explicitly authenticated path.
   */
  @Post()
  @ApiOperation({ summary: 'Create a notification' })
  @ApiResponse({ status: 201, description: 'Notification created.' })
  async create(
    @Body() createNotificationDto: CreateNotificationDto,
    @CurrentUser() user: AuthenticatedNotificationUser,
  ): Promise<Notification> {
    return this.notificationsService.create(
      getRecipientId(user),
      createNotificationDto,
    );
  }

  /**
   * PATCH /notifications/:id/read
   * Mark a specific notification as read
   */
  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  @ApiResponse({ status: 200, description: 'Notification marked as read.' })
  @ApiResponse({ status: 404, description: 'Notification not found.' })
  async markRead(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedNotificationUser,
  ): Promise<Notification> {
    return this.notificationsService.markRead(id, getRecipientId(user));
  }

  /**
   * PATCH /notifications/read-all
   * Mark all notifications for the user as read
   */
  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiResponse({ status: 200, description: 'Notifications marked as read.' })
  async markAllRead(
    @CurrentUser() user: AuthenticatedNotificationUser,
  ): Promise<{ affected: number }> {
    return this.notificationsService.markAllRead(getRecipientId(user));
  }
}
