import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationEventListener } from './listeners/notification-event.listener';
import { NotificationEntity } from './notification.entity';
import { NotificationPreferencesEntity } from './notification-preferences.entity';
import { Users } from '../users/users.entity';
import { CustomI18nModule } from '../i18n/i18n.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([NotificationEntity, NotificationPreferencesEntity, Users]),
    EventEmitterModule.forRoot(),
    CustomI18nModule,
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationEventListener,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
