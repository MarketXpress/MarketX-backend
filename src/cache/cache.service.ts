import { Injectable, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import { CacheConfig, CacheEntry, CacheMetrics, CacheStrategy } from './interfaces/cache.interface';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly redis: Redis;
  private readonly inMemoryCache = new Map<string, CacheEntry>();
  private readonly metrics: CacheMetrics = {
    hits: 0,
    misses: 0,
    hitRate: 0,
    totalRequests: 0,
    averageResponseTime: 0
  };

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      enableReadyCheck: false,
      maxRetriesPerRequest: null,
    });
  }

  async get<T>(key: string, config?: CacheConfig): Promise<T | null> {
    const startTime = Date.now();
    this.metrics.totalRequests++;

    try {
      let result = await this.getFromMemory<T>(key);
      if (result) {
        this.recordHit(startTime);
        return result;
      }

      result = await this.getFromRedis<T>(key);
      if (result) {
        await this.setInMemory(key, result, config || { ttl: 3600 });
        this.recordHit(startTime);
        return result;
      }

      this.recordMiss(startTime);
      return null;
    } catch (error) {
      this.logger.error(`Cache get error for key ${key}:`, error);
      this.recordMiss(startTime);
      return null;
    }
  }

  async set<T>(key: string, value: T, config: CacheConfig = { ttl: 3600 }): Promise<void> {
    try {
      await Promise.all([
        this.setInRedis(key, value, config),
        this.setInMemory(key, value, config)
      ]);
    } catch (error) {
      this.logger.error(`Cache set error for key ${key}:`, error);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await Promise.all([
        this.redis.del(key),
        this.deleteFromMemory(key)
      ]);
    } catch (error) {
      this.logger.error(`Cache delete error for key ${key}:`, error);
    }
  }

  async deleteByTags(tags: string[]): Promise<void> {
    try {
      const keys = await this.getKeysByTags(tags);
      if (keys.length > 0) {
        await Promise.all(keys.map(key => this.delete(key)));
      }
    } catch (error) {
      this.logger.error(`Cache delete by tags error:`, error);
    }
  }

  async flush(): Promise<void> {
    try {
      await this.redis.flushdb();
      this.inMemoryCache.clear();
    } catch (error) {
      this.logger.error(`Cache flush error:`, error);
    }
  }

  async warmUp(data: Array<{ key: string; value: any; config?: CacheConfig }>): Promise<void> {
    try {
      await Promise.all(
        data.map(({ key, value, config }) => this.set(key, value, config))
      );
      this.logger.log(`Cache warmed up with ${data.length} entries`);
    } catch (error) {
      this.logger.error(`Cache warm up error:`, error);
    }
  }

  getMetrics(): CacheMetrics {
    this.metrics.hitRate = this.metrics.totalRequests > 0 
      ? (this.metrics.hits / this.metrics.totalRequests) * 100 
      : 0;
    return { ...this.metrics };
  }

  resetMetrics(): void {
    this.metrics.hits = 0;
    this.metrics.misses = 0;
    this.metrics.totalRequests = 0;
    this.metrics.averageResponseTime = 0;
    this.metrics.hitRate = 0;
  }

  private async getFromMemory<T>(key: string): Promise<T | null> {
    const entry = this.inMemoryCache.get(key);
    if (!entry) return null;

    if (this.isExpired(entry)) {
      this.inMemoryCache.delete(key);
      return null;
    }

    entry.accessCount++;
    entry.lastAccessed = Date.now();
    return entry.data;
  }

  private async getFromRedis<T>(key: string): Promise<T | null> {
    const data = await this.redis.get(key);
    if (!data) return null;

    try {
      const parsed = JSON.parse(data);
      return parsed.data;
    } catch (error) {
      this.logger.error(`Redis parse error for key ${key}:`, error);
      return null;
    }
  }

  private async setInMemory<T>(key: string, value: T, config: CacheConfig): Promise<void> {
    const entry: CacheEntry<T> = {
      data: value,
      timestamp: Date.now(),
      ttl: config.ttl * 1000,
      tags: config.tags || [],
      accessCount: 0,
      lastAccessed: Date.now()
    };

    this.inMemoryCache.set(key, entry);
    this.cleanupMemoryCache();
  }

  private async setInRedis<T>(key: string, value: T, config: CacheConfig): Promise<void> {
    const entry = {
      data: value,
      timestamp: Date.now(),
      tags: config.tags || []
    };

    await this.redis.setex(key, config.ttl, JSON.stringify(entry));

    if (config.tags && config.tags.length > 0) {
      await Promise.all(
        config.tags.map(tag => this.redis.sadd(`tag:${tag}`, key))
      );
    }
  }

  private deleteFromMemory(key: string): void {
    this.inMemoryCache.delete(key);
  }

  private async getKeysByTags(tags: string[]): Promise<string[]> {
    const keys = new Set<string>();
    
    for (const tag of tags) {
      const tagKeys = await this.redis.smembers(`tag:${tag}`);
      tagKeys.forEach(key => keys.add(key));
    }

    return Array.from(keys);
  }

  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  private cleanupMemoryCache(): void {
    const maxItems = parseInt(process.env.CACHE_MAX_MEMORY_ITEMS || '1000', 10);
    
    if (this.inMemoryCache.size <= maxItems) return;

    const entries = Array.from(this.inMemoryCache.entries());
    entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);

    const itemsToRemove = this.inMemoryCache.size - maxItems;
    for (let i = 0; i < itemsToRemove; i++) {
      this.inMemoryCache.delete(entries[i][0]);
    }
  }

  private recordHit(startTime: number): void {
    this.metrics.hits++;
    this.updateAverageResponseTime(startTime);
  }

  private recordMiss(startTime: number): void {
    this.metrics.misses++;
    this.updateAverageResponseTime(startTime);
  }

  private updateAverageResponseTime(startTime: number): void {
    const responseTime = Date.now() - startTime;
    this.metrics.averageResponseTime = 
      (this.metrics.averageResponseTime * (this.metrics.totalRequests - 1) + responseTime) / 
      this.metrics.totalRequests;
  }
}

