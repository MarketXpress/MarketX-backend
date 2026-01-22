import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationsService } from '../notifications.service';

@Injectable()
export class NotificationCleanupTask {
  private readonly logger = new Logger(NotificationCleanupTask.name);

  constructor(private notificationsService: NotificationsService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleExpiredNotificationsCleanup() {
    this.logger.log('Starting expired notifications cleanup...');
    
    try {
      const deletedCount = await this.notificationsService.cleanupExpiredNotifications();
      this.logger.log(`Cleanup completed: ${deletedCount} expired notifications removed`);
    } catch (error) {
      this.logger.error('Error during notifications cleanup:', error);
    }
  }
}