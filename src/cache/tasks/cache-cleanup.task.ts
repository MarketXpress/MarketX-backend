import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CacheService } from '../cache.service';

@Injectable()
export class CacheCleanupTask {
  private readonly logger = new Logger(CacheCleanupTask.name);

  constructor(private readonly cacheService: CacheService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupExpiredKeys() {
    try {
      this.logger.log('Starting cache cleanup task');
      
      const metrics = this.cacheService.getMetrics();
      if (metrics.hitRate < 30) {
        this.logger.warn('Cache hit rate is low, consider reviewing cache strategy');
      }

      this.logger.log('Cache cleanup completed');
    } catch (error) {
      this.logger.error('Cache cleanup failed:', error);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async resetDailyMetrics() {
    this.cacheService.resetMetrics();
    this.logger.log('Daily cache metrics reset');
  }
}
