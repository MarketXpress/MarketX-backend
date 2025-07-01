import { Module, Global } from '@nestjs/common';
import { CacheService } from './cache.service';
import { CacheManagerService } from './cache-manager.service';
import { CacheInterceptor } from './cache.interceptor';
import { CacheMonitoringService } from './cache-monitoring.service';
import { CacheWarmupService } from './cache-warmup.service';
import { CacheCleanupTask } from './tasks/cache-cleanup.task';
import { CacheController } from './cache.controller';

@Global()
@Module({
  controllers: [CacheController],
  providers: [
    CacheService,
    CacheManagerService,
    CacheInterceptor,
    CacheMonitoringService,
    CacheWarmupService,
    CacheCleanupTask,
  ],
  exports: [
    CacheService,
    CacheManagerService,
    CacheInterceptor,
    CacheMonitoringService,
  ]
})
export class CacheModule {}
