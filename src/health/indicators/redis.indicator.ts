import { Injectable } from '@nestjs/common';
import { HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { Redis } from 'ioredis';

@Injectable()
export class RedisIndicator {
  private readonly redis: Redis;

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_DB || '0', 10),

      /*
       * The health check should fail quickly rather than allowing
       * a dead Redis instance to hold readiness probes open.
       */
      connectTimeout: 2_000,
      commandTimeout: 2_000,

      /*
       * Do not keep retrying indefinitely from the health indicator.
       */
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,

      lazyConnect: true,
    });
  }

  async isHealthy(): Promise<HealthIndicatorResult> {
    try {
      if (this.redis.status === 'wait') {
        await this.redis.connect();
      }

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error('Redis health check timeout')),
          2_000,
        );
      });

      const pingPromise = this.redis.ping();

      await Promise.race([pingPromise, timeoutPromise]);

      return {
        redis: {
          status: 'up',
        },
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown Redis error';

      throw new HealthCheckError('Redis check failed', {
        redis: {
          status: 'down',
          message,
        },
      });
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redis.status !== 'end' && this.redis.status !== 'wait') {
      await this.redis.quit().catch(() => undefined);
    }
  }
}
