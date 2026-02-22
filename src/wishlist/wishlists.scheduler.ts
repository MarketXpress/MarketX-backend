import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { WishlistItem } from './entities/wishlist-item.entity';
import { WishlistsService } from './wishlists.service';
import { ProductsService } from '../products/products.service';
import { Product } from '../entities/product.entity';

@Injectable()
export class WishlistPriceScheduler {
  private readonly logger = new Logger(WishlistPriceScheduler.name);

  constructor(
    @InjectRepository(WishlistItem)
    private readonly itemRepo: Repository<WishlistItem>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    private readonly wishlistsService: WishlistsService,
    private readonly productsService: ProductsService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handlePriceSync() {
    this.logger.log('Starting scheduled price sync...');

    // 1. Gather all unique tracked productIds
    const rows = await this.itemRepo
      .createQueryBuilder('item')
      .select('DISTINCT item.productId', 'productId')
      .getRawMany<{ productId: string }>();

    if (!rows.length) return;

    const productIds = rows.map((r) => r.productId);

    // 2. Fetch latest prices from your product catalogue
    const updates = await this.fetchCurrentPrices(productIds);

    // 3. Sync & fire notifications
    await this.wishlistsService.syncPrices(updates);
  }

  /**
   * Fetch current prices from the database Product entity
   */
  private async fetchCurrentPrices(
    productIds: string[],
  ): Promise<Array<{ productId: string; newPrice: number; isAvailable: boolean }>> {
    const updates: Array<{ productId: string; newPrice: number; isAvailable: boolean }> = [];

    for (const productId of productIds) {
      try {
        // Try to get the product from the database entity first
        const dbProduct = await this.productRepo.findOne({
          where: { id: productId },
        });

        if (dbProduct) {
          updates.push({
            productId,
            newPrice: Number(dbProduct.price),
            isAvailable: dbProduct.status === 'active' && dbProduct.available > 0,
          });
        } else {
          // If not in database, try the mock service as fallback
          const mockProduct = await this.productsService.findOne(productId);
          if (mockProduct) {
            // Since mock service doesn't have availability info, assume available if exists
            updates.push({
              productId,
              newPrice: Number(mockProduct.price),
              isAvailable: true, // Assume available if product exists in mock service
            });
          } else {
            // If product doesn't exist anywhere, mark as unavailable
            updates.push({
              productId,
              newPrice: 0,
              isAvailable: false,
            });
          }
        }
      } catch (error) {
        this.logger.error(`Error fetching product ${productId}:`, error);
        // On error, mark as unavailable
        updates.push({
          productId,
          newPrice: 0,
          isAvailable: false,
        });
      }
    }

    return updates;
  }
}