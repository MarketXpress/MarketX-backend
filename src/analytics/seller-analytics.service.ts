import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, Raw } from 'typeorm';
import { Order, OrderStatus } from '../entities/order.entity';
import { Product } from '../entities/product.entity';
import { User } from '../entities/user.entity';
import {
  SellerAnalyticsQueryDto,
  DateRange,
} from './dto/seller-analytics-query.dto';
import {
  SellerAnalyticsResponseDto,
  SalesMetricsDto,
  TimeBasedMetricsDto,
  ProductPerformanceDto,
  CustomerInsightsDto,
  TopCustomerDto,
  OrderStatusBreakdownDto,
  ProductAnalyticsResponseDto,
  CustomerDemographicsDto,
} from './dto/seller-analytics-response.dto';

@Injectable()
export class SellerAnalyticsService {
  private readonly logger = new Logger(SellerAnalyticsService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Get comprehensive seller analytics
   */
  async getSellerAnalytics(
    sellerId: string,
    query: SellerAnalyticsQueryDto,
  ): Promise<SellerAnalyticsResponseDto> {
    const { startDate, endDate } = this.getDateRange(query);

    const [
      salesMetrics,
      timeBasedMetrics,
      topProducts,
      customerInsights,
      orderStatusBreakdown,
    ] = await Promise.all([
      this.calculateSalesMetrics(sellerId, startDate, endDate),
      this.calculateTimeBasedMetrics(sellerId, startDate, endDate),
      this.getTopProducts(sellerId, startDate, endDate),
      this.getCustomerInsights(sellerId, startDate, endDate),
      this.getOrderStatusBreakdown(sellerId, startDate, endDate),
    ]);

    return {
      sellerId,
      startDate,
      endDate,
      salesMetrics,
      timeBasedMetrics,
      topProducts,
      customerInsights,
      orderStatusBreakdown,
    };
  }

  /**
   * Get product-specific analytics
   */
  async getProductAnalytics(
    sellerId: string,
    productId: string,
    query: SellerAnalyticsQueryDto,
  ): Promise<ProductAnalyticsResponseDto> {
    const { startDate, endDate } = this.getDateRange(query);

    const product = await this.productRepository.findOne({
      where: { id: productId, userId: sellerId },
    });

    if (!product) {
      throw new Error('Product not found or does not belong to seller');
    }

    const [salesMetrics, timeBasedMetrics, customerDemographics] =
      await Promise.all([
        this.calculateProductSalesMetrics(productId, startDate, endDate),
        this.calculateProductTimeBasedMetrics(productId, startDate, endDate),
        this.getProductCustomerDemographics(productId, startDate, endDate),
      ]);

    return {
      productId,
      productName: product.title,
      salesMetrics,
      timeBasedMetrics,
      customerDemographics,
    };
  }

  /**
   * Calculate sales metrics for a seller
   */
  private async calculateSalesMetrics(
    sellerId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<SalesMetricsDto> {
    const orders = await this.orderRepository.find({
      where: {
        sellerId,
        createdAt: Between(startDate, endDate),
      },
    });

    const completedOrders = orders.filter(
      (o) => o.status === OrderStatus.COMPLETED || o.status === OrderStatus.DELIVERED,
    );
    const refundedOrders = orders.filter(
      (o) => o.status === OrderStatus.REFUNDED,
    );

    const totalSales = completedOrders.reduce(
      (sum, o) => sum + Number(o.totalAmount),
      0,
    );
    const totalItemsSold = completedOrders.reduce(
      (sum, o) => sum + o.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
      0,
    );
    const totalDiscounts = completedOrders.reduce(
      (sum, o) => sum + Number(o.discountAmount),
      0,
    );
    const totalShipping = completedOrders.reduce(
      (sum, o) => sum + Number(o.shippingCost),
      0,
    );
    const totalTax = completedOrders.reduce(
      (sum, o) => sum + Number(o.taxAmount),
      0,
    );
    const totalRefunds = refundedOrders.reduce(
      (sum, o) => sum + Number(o.totalAmount),
      0,
    );

    return {
      totalSales,
      totalOrders: completedOrders.length,
      averageOrderValue: completedOrders.length > 0 ? totalSales / completedOrders.length : 0,
      totalItemsSold,
      totalRevenue: totalSales - totalDiscounts,
      totalDiscounts,
      totalShipping,
      totalTax,
      netRevenue: totalSales - totalDiscounts - totalRefunds,
      totalRefunds,
      refundedOrders: refundedOrders.length,
    };
  }

  /**
   * Calculate time-based metrics (daily, weekly, monthly)
   */
  private async calculateTimeBasedMetrics(
    sellerId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<TimeBasedMetricsDto[]> {
    const orders = await this.orderRepository.find({
      where: {
        sellerId,
        createdAt: Between(startDate, endDate),
        status: Raw(
          (alias) => `${alias} IN ('completed', 'delivered', 'shipped')`,
        ),
      },
      order: { createdAt: 'ASC' },
    });

    const metricsMap = new Map<string, TimeBasedMetricsDto>();

    orders.forEach((order) => {
      const period = order.createdAt.toISOString().split('T')[0]; // Daily grouping
      const existing = metricsMap.get(period);

      const itemsSold = order.items.reduce(
        (sum, item) => sum + item.quantity,
        0,
      );

      if (existing) {
        existing.sales += Number(order.totalAmount);
        existing.orders += 1;
        existing.itemsSold += itemsSold;
      } else {
        metricsMap.set(period, {
          period,
          sales: Number(order.totalAmount),
          orders: 1,
          itemsSold,
        });
      }
    });

    return Array.from(metricsMap.values()).sort((a, b) =>
      a.period.localeCompare(b.period),
    );
  }

  /**
   * Get top performing products
   */
  private async getTopProducts(
    sellerId: string,
    startDate: Date,
    endDate: Date,
    limit: number = 10,
  ): Promise<ProductPerformanceDto[]> {
    const orders = await this.orderRepository.find({
      where: {
        sellerId,
        createdAt: Between(startDate, endDate),
        status: Raw(
          (alias) => `${alias} IN ('completed', 'delivered')`,
        ),
      },
    });

    const productMap = new Map<
      string,
      {
        name: string;
        category?: string;
        unitsSold: number;
        revenue: number;
        orderCount: number;
        totalPrice: number;
        views: number;
      }
    >();

    // Aggregate product data from orders
    for (const order of orders) {
      for (const item of order.items) {
        const existing = productMap.get(item.productId);
        if (existing) {
          existing.unitsSold += item.quantity;
          existing.revenue += item.subtotal;
          existing.orderCount += 1;
          existing.totalPrice += item.price * item.quantity;
        } else {
          productMap.set(item.productId, {
            name: item.productName,
            unitsSold: item.quantity,
            revenue: item.subtotal,
            orderCount: 1,
            totalPrice: item.price * item.quantity,
            views: 0, // Would need to fetch from product entity
          });
        }
      }
    }

    // Fetch product details for views
    const productIds = Array.from(productMap.keys());
    const products = await this.productRepository.findByIds(productIds);
    const productViewsMap = new Map<string, number>(products.map((p) => [p.id, p.views || 0]));

    const performanceData: ProductPerformanceDto[] = Array.from(
      productMap.entries(),
    ).map(([productId, data]) => {
      const views = productViewsMap.get(productId) || 0;
      return {
        productId,
        productName: data.name,
        unitsSold: data.unitsSold,
        revenue: data.revenue,
        orderCount: data.orderCount,
        averagePrice: data.unitsSold > 0 ? data.totalPrice / data.unitsSold : 0,
        category: data.category,
        views,
        conversionRate: views > 0 ? (data.orderCount / views) * 100 : 0,
      };
    });

    return performanceData
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit);
  }

  /**
   * Get customer insights
   */
  private async getCustomerInsights(
    sellerId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<CustomerInsightsDto> {
    const orders = await this.orderRepository.find({
      where: {
        sellerId,
        createdAt: Between(startDate, endDate),
        status: Raw(
          (alias) => `${alias} IN ('completed', 'delivered')`,
        ),
      },
    });

    const customerMap = new Map<
      string,
      { totalOrders: number; totalSpent: number; lastOrderDate: Date }
    >();

    orders.forEach((order) => {
      const existing = customerMap.get(order.buyerId);
      if (existing) {
        existing.totalOrders += 1;
        existing.totalSpent += Number(order.totalAmount);
        if (order.createdAt > existing.lastOrderDate) {
          existing.lastOrderDate = order.createdAt;
        }
      } else {
        customerMap.set(order.buyerId, {
          totalOrders: 1,
          totalSpent: Number(order.totalAmount),
          lastOrderDate: order.createdAt,
        });
      }
    });

    const totalCustomers = customerMap.size;
    const customersWithMultipleOrders = Array.from(customerMap.values()).filter(
      (c) => c.totalOrders > 1,
    );

    // Get top customers
    const topCustomers: TopCustomerDto[] = await Promise.all(
      Array.from(customerMap.entries())
        .sort((a, b) => b[1].totalSpent - a[1].totalSpent)
        .slice(0, 5)
        .map(async ([userId, data]) => {
          const user = await this.userRepository.findOne({
            where: { id: userId },
          });
          return {
            userId,
            name: user
              ? `${user.firstName || ''} ${user.lastName || ''}`.trim() ||
                user.email
              : 'Unknown',
            totalOrders: data.totalOrders,
            totalSpent: data.totalSpent,
            lastOrderDate: data.lastOrderDate,
          };
        }),
    );

    const totalSpent = Array.from(customerMap.values()).reduce(
      (sum, c) => sum + c.totalSpent,
      0,
    );

    return {
      totalCustomers,
      newCustomers: totalCustomers - customersWithMultipleOrders.length,
      returningCustomers: customersWithMultipleOrders.length,
      averageOrdersPerCustomer:
        totalCustomers > 0
          ? orders.length / totalCustomers
          : 0,
      averageCustomerValue: totalCustomers > 0 ? totalSpent / totalCustomers : 0,
      topCustomers,
    };
  }

  /**
   * Get order status breakdown
   */
  private async getOrderStatusBreakdown(
    sellerId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<OrderStatusBreakdownDto[]> {
    const orders = await this.orderRepository.find({
      where: {
        sellerId,
        createdAt: Between(startDate, endDate),
      },
    });

    const statusCount = new Map<string, number>();
    orders.forEach((order) => {
      const count = statusCount.get(order.status) || 0;
      statusCount.set(order.status, count + 1);
    });

    const total = orders.length;

    return Array.from(statusCount.entries()).map(([status, count]) => ({
      status,
      count,
      percentage: total > 0 ? (count / total) * 100 : 0,
    }));
  }

  /**
   * Calculate product-specific sales metrics
   */
  private async calculateProductSalesMetrics(
    productId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<SalesMetricsDto> {
    const orders = await this.orderRepository.find({
      where: {
        createdAt: Between(startDate, endDate),
        status: Raw(
          (alias) => `${alias} IN ('completed', 'delivered')`,
        ),
      },
    });

    let totalSales = 0;
    let totalOrders = 0;
    let totalItemsSold = 0;
    let totalDiscounts = 0;

    orders.forEach((order) => {
      const productItems = order.items.filter(
        (item) => item.productId === productId,
      );
      if (productItems.length > 0) {
        totalOrders += 1;
        productItems.forEach((item) => {
          totalSales += item.subtotal;
          totalItemsSold += item.quantity;
        });
        // Proportionally allocate discount
        const productSubtotal = productItems.reduce(
          (sum, item) => sum + item.subtotal,
          0,
        );
        const orderSubtotal = order.items.reduce(
          (sum, item) => sum + item.subtotal,
          0,
        );
        if (orderSubtotal > 0) {
          totalDiscounts +=
            (Number(order.discountAmount) * productSubtotal) / orderSubtotal;
        }
      }
    });

    return {
      totalSales,
      totalOrders,
      averageOrderValue: totalOrders > 0 ? totalSales / totalOrders : 0,
      totalItemsSold,
      totalRevenue: totalSales - totalDiscounts,
      totalDiscounts,
      totalShipping: 0,
      totalTax: 0,
      netRevenue: totalSales - totalDiscounts,
      totalRefunds: 0,
      refundedOrders: 0,
    };
  }

  /**
   * Calculate product time-based metrics
   */
  private async calculateProductTimeBasedMetrics(
    productId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<TimeBasedMetricsDto[]> {
    const orders = await this.orderRepository.find({
      where: {
        createdAt: Between(startDate, endDate),
        status: Raw(
          (alias) => `${alias} IN ('completed', 'delivered')`,
        ),
      },
      order: { createdAt: 'ASC' },
    });

    const metricsMap = new Map<string, TimeBasedMetricsDto>();

    orders.forEach((order) => {
      const productItems = order.items.filter(
        (item) => item.productId === productId,
      );
      if (productItems.length > 0) {
        const period = order.createdAt.toISOString().split('T')[0];
        const existing = metricsMap.get(period);

        const sales = productItems.reduce(
          (sum, item) => sum + item.subtotal,
          0,
        );
        const itemsSold = productItems.reduce(
          (sum, item) => sum + item.quantity,
          0,
        );

        if (existing) {
          existing.sales += sales;
          existing.orders += 1;
          existing.itemsSold += itemsSold;
        } else {
          metricsMap.set(period, {
            period,
            sales,
            orders: 1,
            itemsSold,
          });
        }
      }
    });

    return Array.from(metricsMap.values()).sort((a, b) =>
      a.period.localeCompare(b.period),
    );
  }

  /**
   * Get product customer demographics
   */
  private async getProductCustomerDemographics(
    productId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<CustomerDemographicsDto> {
    const orders = await this.orderRepository.find({
      where: {
        createdAt: Between(startDate, endDate),
        status: Raw(
          (alias) => `${alias} IN ('completed', 'delivered')`,
        ),
      },
    });

    const buyerIds = orders
      .filter((order) =>
        order.items.some((item) => item.productId === productId),
      )
      .map((order) => order.buyerId);

    const uniqueBuyerIds = [...new Set(buyerIds)];

    // Geographic distribution (placeholder - would need location data)
    const geographicDistribution: Record<string, number> = {};

    // Purchase frequency
    const purchaseFrequency: Record<string, number> = {};
    buyerIds.forEach((buyerId) => {
      const count = buyerIds.filter((id) => id === buyerId).length;
      const key = count === 1 ? '1' : count <= 3 ? '2-3' : '4+';
      purchaseFrequency[key] = (purchaseFrequency[key] || 0) + 1;
    });

    // Order value distribution
    const orderValueDistribution: Record<string, number> = {};
    orders
      .filter((order) =>
        order.items.some((item) => item.productId === productId),
      )
      .forEach((order) => {
        const value = Number(order.totalAmount);
        let key: string;
        if (value < 50) key = '< $50';
        else if (value < 100) key = '$50 - $100';
        else if (value < 250) key = '$100 - $250';
        else key = '> $250';
        orderValueDistribution[key] = (orderValueDistribution[key] || 0) + 1;
      });

    return {
      geographicDistribution,
      purchaseFrequency,
      orderValueDistribution,
    };
  }

  /**
   * Get date range from query
   */
  private getDateRange(
    query: SellerAnalyticsQueryDto,
  ): { startDate: Date; endDate: Date } {
    if (query.startDate && query.endDate) {
      return { startDate: query.startDate, endDate: query.endDate };
    }

    const now = new Date();
    const endDate = new Date(now);
    let startDate = new Date(now);

    switch (query.dateRange) {
      case DateRange.TODAY:
        startDate.setHours(0, 0, 0, 0);
        break;
      case DateRange.YESTERDAY:
        startDate.setDate(now.getDate() - 1);
        startDate.setHours(0, 0, 0, 0);
        endDate.setDate(now.getDate() - 1);
        endDate.setHours(23, 59, 59, 999);
        break;
      case DateRange.LAST_7_DAYS:
        startDate.setDate(now.getDate() - 7);
        break;
      case DateRange.LAST_30_DAYS:
        startDate.setDate(now.getDate() - 30);
        break;
      case DateRange.THIS_MONTH:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case DateRange.LAST_MONTH:
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate.setDate(0);
        break;
      case DateRange.THIS_YEAR:
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate.setDate(now.getDate() - 30);
    }

    return { startDate, endDate };
  }

  /**
   * Export analytics data
   */
  async exportAnalytics(
    sellerId: string,
    query: SellerAnalyticsQueryDto,
  ): Promise<{
    data: SellerAnalyticsResponseDto;
    csv?: string;
  }> {
    const analytics = await this.getSellerAnalytics(sellerId, query);

    // Generate CSV for sales metrics
    const csvRows = [
      ['Metric', 'Value'],
      ['Total Sales', analytics.salesMetrics.totalSales.toString()],
      ['Total Orders', analytics.salesMetrics.totalOrders.toString()],
      ['Average Order Value', analytics.salesMetrics.averageOrderValue.toString()],
      ['Total Items Sold', analytics.salesMetrics.totalItemsSold.toString()],
      ['Total Revenue', analytics.salesMetrics.totalRevenue.toString()],
      ['Total Discounts', analytics.salesMetrics.totalDiscounts.toString()],
      ['Net Revenue', analytics.salesMetrics.netRevenue.toString()],
      ['Total Refunds', analytics.salesMetrics.totalRefunds.toString()],
    ];

    const csv = csvRows.map((row) => row.join(',')).join('\n');

    return { data: analytics, csv };
  }
}
