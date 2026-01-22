import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { NotificationsService } from '../notifications.service';

@Injectable()
export class NotificationOwnerGuard implements CanActivate {
  constructor(private notificationsService: NotificationsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const notificationId = request.params.id;
    const userId = request.params.userId;
    
    // In a real app, you'd get the current user from the request
    // const currentUser = request.user;
    
    // For now, we'll just check if the notification belongs to the specified user
    try {
      await this.notificationsService.getNotificationById(notificationId, userId);
      return true;
    } catch (error) {
      throw new ForbiddenException('You can only access your own notifications');
    }
  }
}