import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { TypeOrmModule } from '@nestjs/typeorm';

import { HealthController } from './health.controller';
import { DatabaseIndicator } from './indicators/database.indicator';
import { RedisIndicator } from './indicators/redis.indicator';

@Module({
  imports: [TerminusModule, TypeOrmModule],
  controllers: [HealthController],
  providers: [DatabaseIndicator, RedisIndicator],
  exports: [DatabaseIndicator, RedisIndicator],
})
export class HealthModule {}
