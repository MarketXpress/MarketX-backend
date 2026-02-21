import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { UserAnalyticsService } from './user-analytics.service';
import { AnalyticsGateway } from './analytics.gateway';
import { SellersAnalyticsController } from './sellers-analytics.controller';

@Module({
  imports: [CacheModule.register({ ttl: 60 })],
  controllers: [AnalyticsController, SellersAnalyticsController],
  providers: [AnalyticsService, UserAnalyticsService, AnalyticsGateway],
  exports: [AnalyticsService, UserAnalyticsService, AnalyticsGateway],
})
export class AnalyticsModule {}