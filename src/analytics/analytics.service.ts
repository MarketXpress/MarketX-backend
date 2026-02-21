import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Users } from '../users/users.entity';
import { Transaction, TransactionStatus, TransactionType } from '../transactions/entities/transaction.entity';
import { Listing } from '../listing/entities/listing.entity';
import { AnalyticsGateway } from './analytics.gateway';
import { Parser as Json2CsvParser } from 'json2csv';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Users)
    private readonly usersRepository: Repository<Users>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(Listing)
    private readonly listingRepository: Repository<Listing>,
    private readonly analyticsGateway: AnalyticsGateway,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async getPlatformAnalytics(startDate?: string, endDate?: string) {
    const dateFilter = startDate && endDate ? { createdAt: Between(new Date(startDate), new Date(endDate)) } : {};

    // Active users: users who have logged in or performed actions recently (using updatedAt as proxy)
    const activeUsers = await this.usersRepository.count({
      where: startDate && endDate ? { updatedAt: Between(new Date(startDate), new Date(endDate)) } : {},
    });

    // Transaction volume: total number and sum of transactions
    const transactions = await this.transactionRepository.find({ where: { ...dateFilter } });
    const transactionVolume = transactions.length;
    const transactionSum = transactions.reduce((sum, t) => sum + Number(t.amount), 0);

    // Popular categories: count listings per category
    const listings = await this.listingRepository.find({ where: { ...dateFilter } });
    const categoryCount: Record<string, number> = {};
    listings.forEach((listing) => {
      if (listing.category) {
        categoryCount[listing.category] = (categoryCount[listing.category] || 0) + 1;
      }
    });
    const popularCategories = Object.entries(categoryCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([category, count]) => ({ category, count }));

    const result = {
      activeUsers,
      transactionVolume,
      transactionSum,
      popularCategories,
    };
    this.analyticsGateway.emitPlatformAnalyticsUpdate(result);
    return result;
  }

  private mapGranularityToPg(granularity?: 'daily' | 'weekly' | 'monthly') {
    if (granularity === 'weekly') return 'week';
    if (granularity === 'monthly') return 'month';
    return 'day';
  }

  async getSellerSalesAnalytics(sellerId: string, dto: { startDate?: string; endDate?: string; granularity?: 'daily' | 'weekly' | 'monthly'; export?: 'csv' | 'json'; limit?: number; }) {
    const cacheKey = `seller_sales:${sellerId}:${dto.startDate || ''}:${dto.endDate || ''}:${dto.granularity || 'daily'}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached as any;

    const pgGran = this.mapGranularityToPg(dto.granularity);

    const qb = this.transactionRepository.createQueryBuilder('t')
      .innerJoin(Listing, 'l', 'l.id = t.listing_id')
      .where('l.userId = :sellerId', { sellerId })
      .andWhere('t.type = :type', { type: TransactionType.PURCHASE })
      .andWhere('t.status = :status', { status: TransactionStatus.COMPLETED });

    if (dto.startDate && dto.endDate) {
      qb.andWhere('t.created_at BETWEEN :start AND :end', { start: new Date(dto.startDate), end: new Date(dto.endDate) });
    }

    qb.select(`date_trunc('${pgGran}', t.created_at)`, 'period')
      .addSelect('COUNT(*)', 'orders')
      .addSelect('SUM(t.amount)', 'revenue')
      .groupBy('period')
      .orderBy('period', 'ASC');

    const rows = await qb.getRawMany();

    const totalRevenue = rows.reduce((s, r) => s + Number(r.revenue || 0), 0);
    const totalOrders = rows.reduce((s, r) => s + Number(r.orders || 0), 0);

    const data = rows.map((r) => ({ period: r.period, orders: Number(r.orders), revenue: Number(r.revenue) }));

    let csv: string | undefined;
    if (dto.export === 'csv') {
      const parser = new Json2CsvParser({ fields: ['period', 'orders', 'revenue'] });
      csv = parser.parse(data as any);
    }

    const result = { data: { totalRevenue, totalOrders, series: data }, csv };
    await this.cacheManager.set(cacheKey, result, 60);
    return result;
  }

  async getSellerProductPerformance(sellerId: string, dto: { startDate?: string; endDate?: string; limit?: number; export?: 'csv' | 'json' }) {
    const cacheKey = `seller_products:${sellerId}:${dto.startDate || ''}:${dto.endDate || ''}:${dto.limit || 10}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached as any;

    const qb = this.transactionRepository.createQueryBuilder('t')
      .innerJoin(Listing, 'l', 'l.id = t.listing_id')
      .where('l.userId = :sellerId', { sellerId })
      .andWhere('t.type = :type', { type: TransactionType.PURCHASE })
      .andWhere('t.status = :status', { status: TransactionStatus.COMPLETED });

    if (dto.startDate && dto.endDate) {
      qb.andWhere('t.created_at BETWEEN :start AND :end', { start: new Date(dto.startDate), end: new Date(dto.endDate) });
    }

    qb.select('l.id', 'listingId')
      .addSelect('l.title', 'title')
      .addSelect('COUNT(*)', 'unitsSold')
      .addSelect('SUM(t.amount)', 'revenue')
      .groupBy('l.id')
      .addGroupBy('l.title')
      .orderBy('revenue', 'DESC')
      .limit(dto.limit || 10);

    const rows = await qb.getRawMany();

    const data = rows.map((r) => ({ listingId: r.listingId, title: r.title, unitsSold: Number(r.unitsSold), revenue: Number(r.revenue) }));

    let csv: string | undefined;
    if (dto.export === 'csv') {
      const parser = new Json2CsvParser({ fields: ['listingId', 'title', 'unitsSold', 'revenue'] });
      csv = parser.parse(data as any);
    }

    const result = { data, csv };
    await this.cacheManager.set(cacheKey, result, 60);
    return result;
  }
} 