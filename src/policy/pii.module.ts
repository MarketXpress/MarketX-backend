import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';

import { PIIRetentionService } from './services/pii-retention.service';
import { PIIController } from './pii.controller';
import { User } from '../entities/user.entity';
import { RedisCacheModule } from '../redis-caching/redis-cache.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    ScheduleModule.forRoot(),
    RedisCacheModule,
    NotificationsModule,
  ],
  controllers: [PIIController],
  providers: [PIIRetentionService],
  exports: [PIIRetentionService],
})
export class PIIModule {}
