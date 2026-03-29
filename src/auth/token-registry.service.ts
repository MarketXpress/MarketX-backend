import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class TokenRegistryService {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  // Store token with 7-day TTL
  async store(userId: string, token: string): Promise<void> {
    const key = `refresh_token:${userId}:${token}`;
    await this.cacheManager.set(key, 'active', 604800000); // 7 days in ms
  }

  async exists(userId: string, token: string): Promise<boolean> {
    const key = `refresh_token:${userId}:${token}`;
    const val = await this.cacheManager.get(key);
    return !!val;
  }

  async invalidate(userId: string, token: string): Promise<void> {
    const key = `refresh_token:${userId}:${token}`;
    await this.cacheManager.del(key);
  }

  // REUSE DETECTION: Invalidate all tokens for a user
  async invalidateAllForUser(userId: string): Promise<void> {
    const store: any = this.cacheManager.store;
    // Note: 'keys' usage depends on your specific Redis store implementation
    const keys = await store.keys(`refresh_token:${userId}:*`);
    if (keys.length > 0) {
      await Promise.all(keys.map((key: string) => this.cacheManager.del(key)));
    }
  }
}
