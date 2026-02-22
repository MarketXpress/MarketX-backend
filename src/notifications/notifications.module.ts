import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { BullModule } from '@nestjs/bull';

import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationEventListener } from './listeners/notification-event.listener';
import { NotificationEntity } from './notification.entity';
import { Users } from '../users/users.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([NotificationEntity, Users]),
    EventEmitterModule.forRoot(),
    BullModule.registerQueue({
      name: 'email',
    }),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationEventListener,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
