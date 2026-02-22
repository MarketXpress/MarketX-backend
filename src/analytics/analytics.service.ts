import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { User } from '../entities/user.entity';
import { Order, OrderStatus } from '../entities/order.entity';
import { Product } from '../entities/product.entity';
import { AnalyticsGateway } from './analytics.gateway';
import {
  AnalyticsQueryDto,
  AnalyticsGranularity,
  AnalyticsExportFormat,
} from './dto/analytics-query.dto';
import { Parser as Json2CsvParser } from 'json2csv';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    private readonly analyticsGateway: AnalyticsGateway,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  /**
   * Get platform-wide analytics (Admin)
   */
  async getPlatformAnalytics(startDate?: string, endDate?: string) {
    const dateFilter =
      startDate && endDate
        ? { createdAt: Between(new Date(startDate), new Date(endDate)) }
        : {};

    const [activeUsers, transactionCount, listings] = await Promise.all([
      this.usersRepository.count({
        where:
          startDate && endDate
            ? { updatedAt: Between(new Date(startDate), new Date(endDate)) }
            : {},
      }),
      this.orderRepository.count({ where: { ...dateFilter } }),
      this.productRepository.find({ where: { ...dateFilter } }),
    ]);

    // Popular categories
    const categoryCount: Record<string, number> = {};
    listings.forEach((listing) => {
      // Assuming product has category object with name or uses categoryId
      const cat = listing.category?.name || 'Uncategorized';
      categoryCount[cat] = (categoryCount[cat] || 0) + 1;
    });

    const popularCategories = Object.entries(categoryCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([category, count]) => ({ category, count }));

    const result = {
      activeUsers,
      transactionVolume: transactionCount,
      popularCategories,
    };

    this.analyticsGateway.emitPlatformAnalyticsUpdate(result);
    return result;
  }

  /**
   * Get seller sales analytics with metrics and time-based series
   */
  async getSellerSalesAnalytics(sellerId: string, dto: AnalyticsQueryDto) {
    const { startDate, endDate, granularity, limit } = dto;
    const cacheKey = `seller_sales:${sellerId}:${startDate?.toISOString()}:${endDate?.toISOString()}:${granularity}`;
    
    const cached = await this.cacheManager.get(cacheKey);
    if (cached && !dto.export) return cached;

    const queryBuilder = this.orderRepository.createQueryBuilder('order')
      .where('order.sellerId = :sellerId', { sellerId })
      .andWhere('order.status IN (:...statuses)', { 
        statuses: [OrderStatus.COMPLETED, OrderStatus.DELIVERED] 
      });

    if (startDate && endDate) {
      queryBuilder.andWhere('order.createdAt BETWEEN :start AND :end', { 
        start: startDate, 
        end: endDate 
      });
    }

    // 1. Calculate General Metrics
    const metricsResult = await queryBuilder
      .select('SUM(order.totalAmount)', 'totalRevenue')
      .addSelect('COUNT(order.id)', 'totalOrders')
      .addSelect('SUM(order.discountAmount)', 'totalDiscounts')
      .addSelect('SUM(order.shippingCost)', 'totalShipping')
      .getRawOne();

    const totalRevenue = Number(metricsResult.totalRevenue || 0);
    const totalOrders = Number(metricsResult.totalOrders || 0);
    const totalDiscounts = Number(metricsResult.totalDiscounts || 0);
    const netRevenue = totalRevenue - totalDiscounts;

    // 2. Time-based Series
    const pgGran = this.mapGranularityToPg(granularity);
    const series = await queryBuilder
      .select(`DATE_TRUNC('${pgGran}', order.createdAt)`, 'period')
      .addSelect('COUNT(order.id)', 'count')
      .addSelect('SUM(order.totalAmount)', 'revenue')
      .groupBy('period')
      .orderBy('period', 'ASC')
      .getRawMany();

    const formattedSeries = series.map(s => ({
      period: s.period,
      orders: Number(s.count),
      revenue: Number(s.revenue),
    }));

    const result = {
      summary: {
        totalRevenue,
        totalOrders,
        totalDiscounts,
        netRevenue,
        averageOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
      },
      series: formattedSeries,
    };

    if (dto.export === AnalyticsExportFormat.CSV) {
      const parser = new Json2CsvParser({ fields: ['period', 'orders', 'revenue'] });
      return { ...result, csv: parser.parse(formattedSeries) };
    }

    await this.cacheManager.set(cacheKey, result, 300); // 5 min cache
    return result;
  }

  /**
   * Get product performance for a seller
   */
  async getSellerProductPerformance(sellerId: string, dto: AnalyticsQueryDto) {
    const { startDate, endDate, limit } = dto;
    const cacheKey = `seller_products:${sellerId}:${startDate?.toISOString()}:${endDate?.toISOString()}:${limit}`;

    const cached = await this.cacheManager.get(cacheKey);
    if (cached && !dto.export) return cached;

    // We need to join with orders to get sales data per product
    // Since items are jsonb in Order entity, we'll iterate or use a specialized query
    // For performance and TypeORM limits, we'll fetch orders and aggregate
    const orders = await this.orderRepository.find({
      where: {
        sellerId,
        status: In([OrderStatus.COMPLETED, OrderStatus.DELIVERED]),
        ...(startDate && endDate ? { createdAt: Between(startDate, endDate) } : {})
      }
    });

    const productMap = new Map<string, { title: string, unitsSold: number, revenue: number, orders: number }>();

    orders.forEach(order => {
      order.items.forEach(item => {
        const existing = productMap.get(item.productId);
        if (existing) {
          existing.unitsSold += item.quantity;
          existing.revenue += item.subtotal;
          existing.orders += 1;
        } else {
          productMap.set(item.productId, {
            title: item.productName,
            unitsSold: item.quantity,
            revenue: item.subtotal,
            orders: 1
          });
        }
      });
    });

    const performance = Array.from(productMap.entries())
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit);

    if (dto.export === AnalyticsExportFormat.CSV) {
      const parser = new Json2CsvParser({ fields: ['id', 'title', 'unitsSold', 'revenue', 'orders'] });
      return { data: performance, csv: parser.parse(performance) };
    }

    await this.cacheManager.set(cacheKey, performance, 600);
    return performance;
  }

  /**
   * Get customer insights for a seller
   */
  async getSellerCustomerInsights(sellerId: string, dto: AnalyticsQueryDto) {
    const { startDate, endDate } = dto;
    const cacheKey = `seller_customers:${sellerId}:${startDate?.toISOString()}:${endDate?.toISOString()}`;

    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    const orders = await this.orderRepository.find({
      where: {
        sellerId,
        status: In([OrderStatus.COMPLETED, OrderStatus.DELIVERED]),
        ...(startDate && endDate ? { createdAt: Between(startDate, endDate) } : {})
      },
      relations: ['buyer']
    });

    const customerMap = new Map<string, { name: string, email: string, orderCount: number, totalSpent: number }>();

    orders.forEach(order => {
      const buyer = order.buyer;
      if (!buyer) return;

      const existing = customerMap.get(buyer.id);
      if (existing) {
        existing.orderCount += 1;
        existing.totalSpent += Number(order.totalAmount);
      } else {
        customerMap.set(buyer.id, {
          name: `${buyer.firstName || ''} ${buyer.lastName || ''}`.trim() || 'Unknown',
          email: buyer.email,
          orderCount: 1,
          totalSpent: Number(order.totalAmount)
        });
      }
    });

    const customers = Array.from(customerMap.values());
    const repeatCustomers = customers.filter(c => c.orderCount > 1).length;

    const result = {
      totalUniqueCustomers: customers.length,
      repeatCustomers,
      topCustomers: customers.sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 10),
      summary: {
        averageSpentPerCustomer: customers.length > 0 
          ? customers.reduce((s, c) => s + c.totalSpent, 0) / customers.length 
          : 0
      }
    };

    await this.cacheManager.set(cacheKey, result, 1800);
    return result;
  }

  private mapGranularityToPg(granularity?: AnalyticsGranularity) {
    if (granularity === AnalyticsGranularity.WEEKLY) return 'week';
    if (granularity === AnalyticsGranularity.MONTHLY) return 'month';
    return 'day';
  }
}