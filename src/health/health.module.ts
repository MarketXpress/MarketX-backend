import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { DatabaseIndicator } from './indicators/database.indicator';
import { StellarIndicator } from './indicators/stellar.indicator';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';

@Module({
  imports: [
    TerminusModule,
    ConfigModule,
    TypeOrmModule,
    CacheModule.register(),
  ],
  controllers: [HealthController],
  providers: [
    DatabaseIndicator,
    StellarIndicator,
  ],
  exports: [
    DatabaseIndicator,
    StellarIndicator,
  ],
})
export class HealthModule {}