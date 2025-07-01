import { Controller, Get, Query, Param } from '@nestjs/common';
import { UserAnalyticsService } from './user-analytics.service';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(
    private readonly userAnalyticsService: UserAnalyticsService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  @Get('platform')
  async getPlatformAnalytics(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.analyticsService.getPlatformAnalytics(startDate, endDate);
  }

  @Get('user/:userId')
  async getUserAnalytics(
    @Param('userId') userId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    // Fetch all user analytics
    return this.userAnalyticsService.getUserAnalytics(userId, startDate, endDate);
  }
}
