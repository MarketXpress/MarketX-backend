import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cache } from 'cache-manager';

@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);
  private readonly inFlight = new Set<string>();

  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  async executeOnce<T>(
    key: string,
    operation: () => Promise<T>,
    ttlSeconds = 24 * 60 * 60,
  ): Promise<{ executed: boolean; result?: T }> {
    const cacheKey = this.toCacheKey(key);

    if (this.inFlight.has(cacheKey)) {
      return { executed: false };
    }

    const alreadyProcessed = await this.cache.get<string>(cacheKey);
    if (alreadyProcessed) {
      return { executed: false };
    }

    this.inFlight.add(cacheKey);

    try {
      const result = await operation();
      await this.cache.set(cacheKey, new Date().toISOString(), ttlSeconds * 1000);
      return { executed: true, result };
    } catch (error) {
      this.logger.warn(`Idempotent operation failed for key ${cacheKey}`);
      throw error;
    } finally {
      this.inFlight.delete(cacheKey);
    }
  }

  private toCacheKey(key: string): string {
    return `idempotency:${key}`;
  }
}
