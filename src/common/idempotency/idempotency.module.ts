import { Global, Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import Redis from 'ioredis';
import {
  IdempotencyService,
  IDEMPOTENCY_LOCK_CLIENT,
} from './idempotency.service';

@Global()
@Module({
  imports: [CacheModule.register()],
  providers: [
    {
      provide: IDEMPOTENCY_LOCK_CLIENT,
      useFactory: () => {
        return new Redis({
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379', 10),
          password: process.env.REDIS_PASSWORD || undefined,
          // Deliberately the same db Bull uses (REDIS_DB), not the cache
          // module's db. #497's cacheManager.reset() only flushes the
          // cache store, so keeping the lock outside that store means a
          // flush can never silently release an in-flight lock.
          db: parseInt(process.env.REDIS_DB || '0', 10),
        });
      },
    },
    IdempotencyService,
  ],
  exports: [IdempotencyService, CacheModule],
})
export class IdempotencyModule {}
