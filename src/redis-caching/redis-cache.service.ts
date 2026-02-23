import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class RedisCacheService {
  private hits = 0;
  private misses = 0;

  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  async get<T>(key: string): Promise<T | null> {
    const value = await this.cache.get<T>(key);
    if (value !== undefined && value !== null) {
      this.hits++;
      return value;
    }
    this.misses++;
    return null;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    await this.cache.set(key, value, ttl);
  }

  async del(key: string): Promise<void> {
    await this.cache.del(key);
  }

  /**
   * Fetch from cache, or compute + store if absent.
   * @example
   *   const product = await cache.getOrSet(
   *     CacheKeys.productById(id),
   *     () => this.repo.findOne({ where: { id } }),
   *     CacheTTL.PRODUCT_DETAIL,
   *   );
   */
  async getOrSet<T>(key: string, factory: () => Promise<T>, ttl?: number): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;
    const value = await factory();
    await this.set(key, value, ttl);
    return value;
  }

  /**
   * Invalidate all keys that begin with `prefix`.
   * Works with the ioredis store via store.keys().
   * @example invalidateByPrefix('products:search:')
   */
  async invalidateByPrefix(prefix: string): Promise<number> {
    const store = (this.cache as any).store;
    if (!store || typeof store.keys !== 'function') return 0;
    const keys: string[] = await store.keys(`${prefix}*`);
    if (!keys.length) return 0;
    await Promise.all(keys.map((k) => this.cache.del(k)));
    return keys.length;
  }

  getStats() {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      total,
      hitRatio: total > 0 ? `${((this.hits / total) * 100).toFixed(1)}%` : 'N/A',
    };
  }

  resetStats(): void {
    this.hits = 0;
    this.misses = 0;
  }
}