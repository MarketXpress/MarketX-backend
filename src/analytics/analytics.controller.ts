import {
  Controller,
  Get,
  Query,
  UseGuards,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../Authentication/jwt-auth-guard';
import { CurrentUser } from '../Authentication/current-user.decorator';
import { AnalyticsService } from './analytics.service';
import { AnalyticsQueryDto, AnalyticsExportFormat } from './dto/analytics-query.dto';
import { Response } from 'express';

@ApiTags('Analytics')
@Controller('sellers/analytics')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) { }

  @Get('sales')
  @ApiOperation({ summary: 'Get seller sales metrics and revenue tracking' })
  @ApiResponse({ status: 200, description: 'Sales metrics and time-series data' })
  async getSalesAnalytics(
    @CurrentUser() user: any,
    @Query() query: AnalyticsQueryDto,
    @Res() res: Response,
  ) {
    const sellerId = user.id.toString();
    const result = await this.analyticsService.getSellerSalesAnalytics(sellerId, query) as any;

    if (query.export === AnalyticsExportFormat.CSV && result.csv) {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="sales-analytics-${new Date().toISOString().split('T')[0]}.csv"`,
      );
      return res.status(HttpStatus.OK).send(result.csv);
    }

    return res.status(HttpStatus.OK).json(result);
  }

  @Get('products')
  @ApiOperation({ summary: 'Get best-selling products and performance metrics' })
  @ApiResponse({ status: 200, description: 'Product performance data' })
  async getProductAnalytics(
    @CurrentUser() user: any,
    @Query() query: AnalyticsQueryDto,
    @Res() res: Response,
  ) {
    const sellerId = user.id.toString();
    const result = await this.analyticsService.getSellerProductPerformance(sellerId, query) as any;

    if (query.export === AnalyticsExportFormat.CSV && result.csv) {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="product-performance-${new Date().toISOString().split('T')[0]}.csv"`,
      );
      return res.status(HttpStatus.OK).send(result.csv);
    }

    return res.status(HttpStatus.OK).json(result);
  }

  @Get('customers')
  @ApiOperation({ summary: 'Get customer insights and demographics' })
  @ApiResponse({ status: 200, description: 'Customer demographics and behavior' })
  async getCustomerInsights(
    @CurrentUser() user: any,
    @Query() query: AnalyticsQueryDto,
  ) {
    const sellerId = user.id.toString();
    return this.analyticsService.getSellerCustomerInsights(sellerId, query);
  }
}
