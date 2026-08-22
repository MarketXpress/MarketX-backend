import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './notification.entity';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsSseController } from './notifications-sse.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Notification])],
  providers: [NotificationsService],
  // Static routes must be registered before NotificationsController's `:id`
  // route so `/notifications/stream` reaches the authenticated SSE handler.
  controllers: [NotificationsSseController, NotificationsController],
  exports: [NotificationsService],
})
export class NotificationsModule {}
