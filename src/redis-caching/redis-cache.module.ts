import { Global, Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisCacheService } from './redis-cache.service';
import { CacheAdminController } from './cache-admin.controller';
import * as redisStore from 'cache-manager-ioredis';

@Global()
@Module({
  imports: [
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        store: redisStore,
        host: config.get<string>('REDIS_HOST', 'localhost'),
        port: config.get<number>('REDIS_PORT', 6379),
        ttl: 60,   // default TTL in seconds
        max: 2000, // max items in cache
      }),
    }),
  ],
  providers: [RedisCacheService],
  controllers: [CacheAdminController],
  exports: [RedisCacheService],
})
export class RedisCacheModule {}