import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { UserAnalyticsService } from './user-analytics.service';
import { AnalyticsGateway } from './analytics.gateway';

@Module({
  controllers: [AnalyticsController],
  providers: [AnalyticsService, UserAnalyticsService, AnalyticsGateway],
  exports: [AnalyticsService, UserAnalyticsService, AnalyticsGateway],
})
export class AnalyticsModule {} 