import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    Req,
    HttpStatus,
    HttpCode,
  } from '@nestjs/common';
  import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiParam,
    ApiQuery,
  } from '@nestjs/swagger';
  
  import { NotificationsService } from './notifications.service';
  import { NotificationEntity } from './notification.entity';
  import {
    CreateNotificationDto,
    UpdateNotificationDto,
    NotificationQueryDto,
    BulkActionDto,
    TransactionNotificationDto,
  } from './dto/notification.dto';
  
  // Placeholder for auth guard - implement according to your auth system
  // import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
  
  @ApiTags('Notifications')
  @Controller('notifications')
  // @UseGuards(JwtAuthGuard) // Uncomment when auth is implemented
  @ApiBearerAuth()
  export class NotificationsController {
    constructor(private readonly notificationsService: NotificationsService) {}
  
    @Post()
    @ApiOperation({ summary: 'Create a new notification' })
    @ApiResponse({ status: HttpStatus.CREATED, description: 'Notification created successfully', type: NotificationEntity })
    async createNotification(@Body() createNotificationDto: CreateNotificationDto): Promise<NotificationEntity> {
      return this.notificationsService.createNotification(createNotificationDto);
    }
  
    @Post('transaction-received')
    @ApiOperation({ summary: 'Send transaction received notification' })
    @ApiResponse({ status: HttpStatus.CREATED, description: 'Transaction notification sent successfully' })
    async sendTransactionNotification(
      @Body() transactionDto: TransactionNotificationDto
    ): Promise<NotificationEntity> {
      return this.notificationsService.sendTransactionReceivedNotification(
        transactionDto.userId,
        transactionDto.transactionId,
        transactionDto.amount,
        transactionDto.currency
      );
    }
  
    @Get('user/:userId')
    @ApiOperation({ summary: 'Get notifications for a specific user' })
    @ApiParam({ name: 'userId', description: 'User ID' })
    @ApiResponse({ status: HttpStatus.OK, description: 'User notifications retrieved successfully' })
    async getUserNotifications(
      @Param('userId') userId: string,
      @Query() queryDto: NotificationQueryDto
    ) {
      return this.notificationsService.getUserNotifications(userId, queryDto);
    }
  
    @Get('user/:userId/stats')
    @ApiOperation({ summary: 'Get notification statistics for a user' })
    @ApiParam({ name: 'userId', description: 'User ID' })
    @ApiResponse({ status: HttpStatus.OK, description: 'User notification statistics' })
    async getUserStats(@Param('userId') userId: string) {
      return this.notificationsService.getUserNotificationStats(userId);
    }
  
    @Get(':id/user/:userId')
    @ApiOperation({ summary: 'Get a specific notification' })
    @ApiParam({ name: 'id', description: 'Notification ID' })
    @ApiParam({ name: 'userId', description: 'User ID' })
    @ApiResponse({ status: HttpStatus.OK, description: 'Notification retrieved successfully', type: NotificationEntity })
    async getNotification(
      @Param('id') id: string,
      @Param('userId') userId: string
    ): Promise<NotificationEntity> {
      return this.notificationsService.getNotificationById(id, userId);
    }
  
    @Put(':id/user/:userId')
    @ApiOperation({ summary: 'Update a notification' })
    @ApiParam({ name: 'id', description: 'Notification ID' })
    @ApiParam({ name: 'userId', description: 'User ID' })
    @ApiResponse({ status: HttpStatus.OK, description: 'Notification updated successfully', type: NotificationEntity })
    async updateNotification(
      @Param('id') id: string,
      @Param('userId') userId: string,
      @Body() updateDto: UpdateNotificationDto
    ): Promise<NotificationEntity> {
      return this.notificationsService.updateNotification(id, userId, updateDto);
    }
  
    @Put(':id/user/:userId/read')
    @ApiOperation({ summary: 'Mark notification as read' })
    @ApiParam({ name: 'id', description: 'Notification ID' })
    @ApiParam({ name: 'userId', description: 'User ID' })
    @ApiResponse({ status: HttpStatus.OK, description: 'Notification marked as read', type: NotificationEntity })
    async markAsRead(
      @Param('id') id: string,
      @Param('userId') userId: string
    ): Promise<NotificationEntity> {
      return this.notificationsService.markAsRead(id, userId);
    }
  
    @Put('user/:userId/mark-all-read')
    @ApiOperation({ summary: 'Mark all notifications as read for a user' })
    @ApiParam({ name: 'userId', description: 'User ID' })
    @ApiResponse({ status: HttpStatus.OK, description: 'All notifications marked as read' })
    @HttpCode(HttpStatus.OK)
    async markAllAsRead(@Param('userId') userId: string): Promise<{ message: string }> {
      await this.notificationsService.markAllAsRead(userId);
      return { message: 'All notifications marked as read' };
    }
  
    @Put('user/:userId/mark-multiple-read')
    @ApiOperation({ summary: 'Mark multiple notifications as read' })
    @ApiParam({ name: 'userId', description: 'User ID' })
    @ApiResponse({ status: HttpStatus.OK, description: 'Selected notifications marked as read' })
    @HttpCode(HttpStatus.OK)
    async markMultipleAsRead(
      @Param('userId') userId: string,
      @Body() bulkActionDto: BulkActionDto
    ): Promise<{ message: string }> {
      await this.notificationsService.markMultipleAsRead(bulkActionDto.notificationIds, userId);
      return { message: `${bulkActionDto.notificationIds.length} notifications marked as read` };
    }
  
    @Delete(':id/user/:userId')
    @ApiOperation({ summary: 'Delete a notification' })
    @ApiParam({ name: 'id', description: 'Notification ID' })
    @ApiParam({ name: 'userId', description: 'User ID' })
    @ApiResponse({ status: HttpStatus.OK, description: 'Notification deleted successfully' })
    @HttpCode(HttpStatus.OK)
    async deleteNotification(
      @Param('id') id: string,
      @Param('userId') userId: string
    ): Promise<{ message: string }> {
      await this.notificationsService.deleteNotification(id, userId);
      return { message: 'Notification deleted successfully' };
    }
  
    @Delete('user/:userId/bulk')
    @ApiOperation({ summary: 'Delete multiple notifications' })
    @ApiParam({ name: 'userId', description: 'User ID' })
    @ApiResponse({ status: HttpStatus.OK, description: 'Notifications deleted successfully' })
    @HttpCode(HttpStatus.OK)
    async deleteMultipleNotifications(
      @Param('userId') userId: string,
      @Body() bulkActionDto: BulkActionDto
    ): Promise<{ message: string }> {
      await this.notificationsService.deleteMultipleNotifications(bulkActionDto.notificationIds, userId);
      return { message: `${bulkActionDto.notificationIds.length} notifications deleted successfully` };
    }
  
    @Post('bulk')
    @ApiOperation({ summary: 'Create multiple notifications' })
    @ApiResponse({ status: HttpStatus.CREATED, description: 'Bulk notifications created successfully' })
    async createBulkNotifications(
      @Body() notifications: CreateNotificationDto[]
    ): Promise<NotificationEntity[]> {
      return this.notificationsService.sendBulkNotifications(notifications);
    }
  }
