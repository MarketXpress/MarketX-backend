import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { BullModule } from '@nestjs/bull';
import { JwtModule } from '@nestjs/jwt';

import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationEventListener } from './listeners/notification-event.listener';
import { NotificationGateway } from './notification.gateway';
import { NotificationEntity } from './notification.entity';
import { NotificationPreferencesEntity } from './notification-preferences.entity';
import { Users } from '../users/users.entity';
import { CustomI18nModule } from '../i18n/i18n.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      NotificationEntity,
      NotificationPreferencesEntity,
      Users,
    ]),
    EventEmitterModule.forRoot(),
    BullModule.registerQueue({
      name: 'email',
    }),
    JwtModule.register({}),
    CustomI18nModule,
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationEventListener,
    NotificationGateway,
  ],
  exports: [NotificationsService, NotificationGateway],
})
export class NotificationsModule {}
