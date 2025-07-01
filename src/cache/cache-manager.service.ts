import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from './cache.service';
import { CacheConfig } from './interfaces/cache.interface';

@Injectable()
export class CacheManagerService {
  private readonly logger = new Logger(CacheManagerService.name);

  constructor(private readonly cacheService: CacheService) {}

  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    config: CacheConfig = { ttl: 3600 }
  ): Promise<T> {
    try {
      const cached = await this.cacheService.get<T>(key, config);
      if (cached !== null) {
        return cached;
      }

      const result = await factory();
      await this.cacheService.set(key, result, config);
      return result;
    } catch (error) {
      this.logger.error(`Cache getOrSet error for key ${key}:`, error);
      return factory();
    }
  }

  async invalidatePattern(pattern: string): Promise<void> {
    try {
      const keys = await this.getKeysByPattern(pattern);
      await Promise.all(keys.map(key => this.cacheService.delete(key)));
    } catch (error) {
      this.logger.error(`Cache invalidate pattern error for ${pattern}:`, error);
    }
  }

  async invalidateUser(userId: string): Promise<void> {
    await this.invalidatePattern(`user:${userId}:*`);
  }

  async invalidateListing(listingId: string): Promise<void> {
    await Promise.all([
      this.invalidatePattern(`listing:${listingId}:*`),
      this.cacheService.deleteByTags(['listings', `listing:${listingId}`])
    ]);
  }

  async invalidateMarketplace(marketplaceId: string): Promise<void> {
    await Promise.all([
      this.invalidatePattern(`marketplace:${marketplaceId}:*`),
      this.cacheService.deleteByTags(['marketplaces', `marketplace:${marketplaceId}`])
    ]);
  }

  private async getKeysByPattern(pattern: string): Promise<string[]> {
    return []; 
  }
}

