import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
// npm i @nestjs/schedule
// import { Cron, CronExpression } from '@nestjs/schedule';
import { WishlistItem } from './entities/wishlist-item.entity';
import { WishlistsService } from './wishlists.service';

/**
 * Scheduler that periodically fetches current product prices
 * and calls WishlistsService.syncPrices().
 *
 * To activate:
 *  1. npm install @nestjs/schedule
 *  2. Import ScheduleModule.forRoot() in AppModule
 *  3. Uncomment the @Cron decorator below
 *  4. Implement fetchCurrentPrices() to hit your product catalogue
 */
@Injectable()
export class WishlistPriceScheduler {
  private readonly logger = new Logger(WishlistPriceScheduler.name);

  constructor(
    @InjectRepository(WishlistItem)
    private readonly itemRepo: Repository<WishlistItem>,
    private readonly wishlistsService: WishlistsService,
  ) {}

  // @Cron(CronExpression.EVERY_HOUR)
  async handlePriceSync() {
    this.logger.log('Starting scheduled price sync...');

    // 1. Gather all unique tracked productIds
    const rows = await this.itemRepo
      .createQueryBuilder('item')
      .select('DISTINCT item.productId', 'productId')
      .getRawMany<{ productId: string }>();

    if (!rows.length) return;

    const productIds = rows.map((r) => r.productId);

    // 2. Fetch latest prices from your product catalogue (replace this stub)
    const updates = await this.fetchCurrentPrices(productIds);

    // 3. Sync & fire notifications
    await this.wishlistsService.syncPrices(updates /*, notificationService */);
  }

  /**
   * Replace this stub with a real call to your ProductsService or HTTP client.
   * Must return { productId, newPrice, isAvailable } for each id.
   */
  private async fetchCurrentPrices(
    productIds: string[],
  ): Promise<Array<{ productId: string; newPrice: number; isAvailable: boolean }>> {
    this.logger.warn(
      'fetchCurrentPrices() is a stub — wire up your product service here',
    );
    // Example stub — replace:
    return productIds.map((id) => ({
      productId: id,
      newPrice: 0, // fetch real price
      isAvailable: true,
    }));
  }
}