import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThan } from 'typeorm';
import { Users } from '../users/users.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { Listing } from '../listing/entities/listing.entity';
import { AnalyticsGateway } from './analytics.gateway';

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
} 