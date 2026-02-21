import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SalesMetricsDto {
  @ApiProperty({ description: 'Total sales amount' })
  totalSales: number;

  @ApiProperty({ description: 'Total number of orders' })
  totalOrders: number;

  @ApiProperty({ description: 'Average order value' })
  averageOrderValue: number;

  @ApiProperty({ description: 'Total items sold' })
  totalItemsSold: number;

  @ApiProperty({ description: 'Total revenue (after discounts)' })
  totalRevenue: number;

  @ApiProperty({ description: 'Total discounts given' })
  totalDiscounts: number;

  @ApiProperty({ description: 'Total shipping costs' })
  totalShipping: number;

  @ApiProperty({ description: 'Total tax collected' })
  totalTax: number;

  @ApiProperty({ description: 'Net revenue (revenue - refunds)' })
  netRevenue: number;

  @ApiProperty({ description: 'Total refunds issued' })
  totalRefunds: number;

  @ApiProperty({ description: 'Number of refunded orders' })
  refundedOrders: number;
}

export class TimeBasedMetricsDto {
  @ApiProperty({ description: 'Date period' })
  period: string;

  @ApiProperty({ description: 'Sales amount for period' })
  sales: number;

  @ApiProperty({ description: 'Number of orders for period' })
  orders: number;

  @ApiProperty({ description: 'Items sold for period' })
  itemsSold: number;
}

export class ProductPerformanceDto {
  @ApiProperty({ description: 'Product ID' })
  productId: string;

  @ApiProperty({ description: 'Product name' })
  productName: string;

  @ApiProperty({ description: 'Units sold' })
  unitsSold: number;

  @ApiProperty({ description: 'Total revenue from product' })
  revenue: number;

  @ApiProperty({ description: 'Number of orders containing this product' })
  orderCount: number;

  @ApiProperty({ description: 'Average price sold at' })
  averagePrice: number;

  @ApiPropertyOptional({ description: 'Product category' })
  category?: string;

  @ApiProperty({ description: 'Product views (if available)' })
  views: number;

  @ApiProperty({ description: 'Conversion rate (orders/views)' })
  conversionRate: number;
}

export class CustomerInsightsDto {
  @ApiProperty({ description: 'Total unique customers' })
  totalCustomers: number;

  @ApiProperty({ description: 'New customers in period' })
  newCustomers: number;

  @ApiProperty({ description: 'Returning customers' })
  returningCustomers: number;

  @ApiProperty({ description: 'Average orders per customer' })
  averageOrdersPerCustomer: number;

  @ApiProperty({ description: 'Average customer lifetime value' })
  averageCustomerValue: number;

  @ApiProperty({ description: 'Top customers by purchase amount' })
  topCustomers: TopCustomerDto[];
}

export class TopCustomerDto {
  @ApiProperty({ description: 'Customer user ID' })
  userId: string;

  @ApiProperty({ description: 'Customer name' })
  name: string;

  @ApiProperty({ description: 'Total orders' })
  totalOrders: number;

  @ApiProperty({ description: 'Total spent' })
  totalSpent: number;

  @ApiProperty({ description: 'Last order date' })
  lastOrderDate: Date;
}

export class OrderStatusBreakdownDto {
  @ApiProperty({ description: 'Order status' })
  status: string;

  @ApiProperty({ description: 'Count of orders with this status' })
  count: number;

  @ApiProperty({ description: 'Percentage of total orders' })
  percentage: number;
}

export class SellerAnalyticsResponseDto {
  @ApiProperty({ description: 'Seller ID' })
  sellerId: string;

  @ApiProperty({ description: 'Analytics period start' })
  startDate: Date;

  @ApiProperty({ description: 'Analytics period end' })
  endDate: Date;

  @ApiProperty({ type: SalesMetricsDto })
  salesMetrics: SalesMetricsDto;

  @ApiProperty({ type: [TimeBasedMetricsDto] })
  timeBasedMetrics: TimeBasedMetricsDto[];

  @ApiProperty({ type: [ProductPerformanceDto] })
  topProducts: ProductPerformanceDto[];

  @ApiProperty({ type: CustomerInsightsDto })
  customerInsights: CustomerInsightsDto;

  @ApiProperty({ type: [OrderStatusBreakdownDto] })
  orderStatusBreakdown: OrderStatusBreakdownDto[];
}

export class ProductAnalyticsResponseDto {
  @ApiProperty({ description: 'Product ID' })
  productId: string;

  @ApiProperty({ description: 'Product name' })
  productName: string;

  @ApiProperty({ type: SalesMetricsDto })
  salesMetrics: SalesMetricsDto;

  @ApiProperty({ type: [TimeBasedMetricsDto] })
  timeBasedMetrics: TimeBasedMetricsDto[];

  @ApiProperty({ description: 'Customer demographics for this product' })
  customerDemographics: CustomerDemographicsDto;
}

export class CustomerDemographicsDto {
  @ApiProperty({ description: 'Geographic distribution' })
  geographicDistribution: Record<string, number>;

  @ApiProperty({ description: 'Purchase frequency distribution' })
  purchaseFrequency: Record<string, number>;

  @ApiProperty({ description: 'Average order value distribution' })
  orderValueDistribution: Record<string, number>;
}
