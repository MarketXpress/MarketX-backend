import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

@Controller('sellers/analytics')
export class SellersAnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('sales')
  async getSales(@Query() query: any) {
    if (!query.sellerId) throw new BadRequestException('sellerId is required');
    const result = await this.analyticsService.getSellerSalesAnalytics(query.sellerId, query);
    if (query.export === 'csv') return { csv: result.csv };
    return result.data;
  }

  @Get('products')
  async getProducts(@Query() query: any) {
    if (!query.sellerId) throw new BadRequestException('sellerId is required');
    const result = await this.analyticsService.getSellerProductPerformance(query.sellerId, query);
    if (query.export === 'csv') return { csv: result.csv };
    return result.data;
  }

  @Get('customers')
  async getCustomerDemographics(@Query() query: any) {
    if (!query.sellerId) throw new BadRequestException('sellerId is required');
    const result = await this.analyticsService.getSellerCustomerDemographics(query.sellerId, query);
    if (query.export === 'csv') return { csv: result.csv };
    return result.data;
  }
}
