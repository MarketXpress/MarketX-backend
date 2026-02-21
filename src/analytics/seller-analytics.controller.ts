import {
  Controller,
  Get,
  Query,
  Param,
  ParseUUIDPipe,
  Res,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { Response } from 'express';
import { SellerAnalyticsService } from './seller-analytics.service';
import {
  SellerAnalyticsQueryDto,
  ExportAnalyticsQueryDto,
  DateRange,
  ExportFormat,
} from './dto/seller-analytics-query.dto';
import {
  SellerAnalyticsResponseDto,
  ProductAnalyticsResponseDto,
} from './dto/seller-analytics-response.dto';

@ApiTags('Seller Analytics')
@Controller('sellers/analytics')
export class SellerAnalyticsController {
  constructor(
    private readonly sellerAnalyticsService: SellerAnalyticsService,
  ) {}

  /**
   * Get seller sales analytics
   * GET /sellers/analytics/sales
   */
  @Get('sales')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get seller sales analytics',
    description: 'Retrieve comprehensive sales metrics including revenue, orders, and performance data',
  })
  @ApiQuery({
    name: 'sellerId',
    required: true,
    description: 'Seller user ID',
  })
  @ApiQuery({
    name: 'dateRange',
    required: false,
    enum: DateRange,
    description: 'Predefined date range',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'Custom start date (ISO format)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: 'Custom end date (ISO format)',
  })
  @ApiResponse({
    status: 200,
    description: 'Seller analytics data',
    type: SellerAnalyticsResponseDto,
  })
  async getSalesAnalytics(
    @Query('sellerId') sellerId: string,
    @Query() query: SellerAnalyticsQueryDto,
  ): Promise<SellerAnalyticsResponseDto> {
    return this.sellerAnalyticsService.getSellerAnalytics(sellerId, query);
  }

  /**
   * Get seller product analytics
   * GET /sellers/analytics/products
   */
  @Get('products')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get seller product analytics',
    description: 'Retrieve product performance metrics including top-selling products',
  })
  @ApiQuery({
    name: 'sellerId',
    required: true,
    description: 'Seller user ID',
  })
  @ApiQuery({
    name: 'dateRange',
    required: false,
    enum: DateRange,
    description: 'Predefined date range',
  })
  @ApiResponse({
    status: 200,
    description: 'Product analytics data',
    type: SellerAnalyticsResponseDto,
  })
  async getProductAnalytics(
    @Query('sellerId') sellerId: string,
    @Query() query: SellerAnalyticsQueryDto,
  ): Promise<SellerAnalyticsResponseDto> {
    return this.sellerAnalyticsService.getSellerAnalytics(sellerId, query);
  }

  /**
   * Get specific product analytics
   * GET /sellers/analytics/products/:productId
   */
  @Get('products/:productId')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get specific product analytics',
    description: 'Retrieve detailed analytics for a specific product',
  })
  @ApiParam({ name: 'productId', description: 'Product ID (UUID)' })
  @ApiQuery({
    name: 'sellerId',
    required: true,
    description: 'Seller user ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Product analytics data',
    type: ProductAnalyticsResponseDto,
  })
  async getSpecificProductAnalytics(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Query('sellerId') sellerId: string,
    @Query() query: SellerAnalyticsQueryDto,
  ): Promise<ProductAnalyticsResponseDto> {
    return this.sellerAnalyticsService.getProductAnalytics(
      sellerId,
      productId,
      query,
    );
  }

  /**
   * Export seller analytics
   * GET /sellers/analytics/export
   */
  @Get('export')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Export seller analytics',
    description: 'Export analytics data as JSON or CSV',
  })
  @ApiQuery({
    name: 'sellerId',
    required: true,
    description: 'Seller user ID',
  })
  @ApiQuery({
    name: 'format',
    required: false,
    enum: ExportFormat,
    description: 'Export format',
  })
  @ApiResponse({
    status: 200,
    description: 'Exported analytics data',
  })
  async exportAnalytics(
    @Query('sellerId') sellerId: string,
    @Query() query: ExportAnalyticsQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const { data, csv } = await this.sellerAnalyticsService.exportAnalytics(
      sellerId,
      query,
    );

    if (query.format === ExportFormat.CSV && csv) {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="analytics-${sellerId}-${new Date().toISOString().split('T')[0]}.csv"`,
      );
      res.status(HttpStatus.OK).send(csv);
    } else {
      res.status(HttpStatus.OK).json(data);
    }
  }

  /**
   * Get seller customer insights
   * GET /sellers/analytics/customers
   */
  @Get('customers')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get seller customer insights',
    description: 'Retrieve customer demographics and behavior analytics',
  })
  @ApiQuery({
    name: 'sellerId',
    required: true,
    description: 'Seller user ID',
  })
  @ApiQuery({
    name: 'dateRange',
    required: false,
    enum: DateRange,
    description: 'Predefined date range',
  })
  @ApiResponse({
    status: 200,
    description: 'Customer insights data',
  })
  async getCustomerInsights(
    @Query('sellerId') sellerId: string,
    @Query() query: SellerAnalyticsQueryDto,
  ): Promise<SellerAnalyticsResponseDto> {
    return this.sellerAnalyticsService.getSellerAnalytics(sellerId, query);
  }

  /**
   * Get daily sales report
   * GET /sellers/analytics/daily
   */
  @Get('daily')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get daily sales report',
    description: 'Retrieve daily sales metrics for the specified period',
  })
  @ApiQuery({
    name: 'sellerId',
    required: true,
    description: 'Seller user ID',
  })
  @ApiQuery({
    name: 'dateRange',
    required: false,
    enum: DateRange,
    description: 'Predefined date range',
  })
  @ApiResponse({
    status: 200,
    description: 'Daily sales report',
  })
  async getDailyReport(
    @Query('sellerId') sellerId: string,
    @Query() query: SellerAnalyticsQueryDto,
  ): Promise<SellerAnalyticsResponseDto> {
    return this.sellerAnalyticsService.getSellerAnalytics(sellerId, query);
  }
}
