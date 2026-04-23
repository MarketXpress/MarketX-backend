import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { JwtModule } from '@nestjs/jwt';

import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationEventListener } from './listeners/notification-event.listener';
import { NotificationGateway } from './notification.gateway';
import { NotificationEntity } from './notification.entity';
import { NotificationPreferencesEntity } from './notification-preferences.entity';
import { Users } from '../users/users.entity';
import { CustomI18nModule } from '../i18n/i18n.module';
import { CacheModule } from '../cache/cache.module';
import { JobsModule } from '../job-processing/jobs.module';
import { JWT_CONSTANTS } from '../Authentication/jwt-payload.interface';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      NotificationEntity,
      NotificationPreferencesEntity,
      Users,
    ]),
    EventEmitterModule,
    JobsModule,
    JwtModule.register({
      secret: JWT_CONSTANTS.accessTokenSecret,
    }),
    CacheModule,
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
