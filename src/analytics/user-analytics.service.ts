import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Listing } from '../listing/entities/listing.entity';
import { Transaction, TransactionType } from '../transactions/entities/transaction.entity';
import { FavoritesService } from '../favorites/favorites.service';
import { AnalyticsGateway } from './analytics.gateway';

@Injectable()
export class UserAnalyticsService {
  constructor(
    @InjectRepository(Listing)
    private readonly listingRepository: Repository<Listing>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @Inject(forwardRef(() => FavoritesService))
    private readonly favoritesService: FavoritesService,
    private readonly analyticsGateway: AnalyticsGateway,
  ) {}

  async getUserAnalytics(userId: string, startDate?: string, endDate?: string) {
    // Date range filter
    const dateFilter = startDate && endDate ? { createdAt: Between(new Date(startDate), new Date(endDate)) } : {};

    // Sales: Listings created by user (userId is string/uuid)
    const sales = await this.listingRepository.count({
      where: { userId, ...dateFilter },
    });

    // Purchases: Transactions where user is the buyer (receiverId is number)
    const purchases = await this.transactionRepository.count({
      where: { receiverId: Number(userId), type: TransactionType.PURCHASE, ...dateFilter },
    });

    // Favorites: Use FavoritesService
    const favorites = await this.favoritesService.getUserFavorites(Number(userId));

    // Views: Sum views for all listings by user
    const userListings = await this.listingRepository.find({ where: { userId, ...dateFilter } });
    const views = userListings.reduce((sum, listing) => sum + (listing.views || 0), 0);

    const result = {
      sales,
      purchases,
      views,
      favorites: favorites.length,
      favoritesList: favorites,
    };
    this.analyticsGateway.emitUserAnalyticsUpdate(userId, result);
    return result;
  }
}
