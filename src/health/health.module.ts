import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { DatabaseIndicator } from './indicators/database.indicator';
import { StellarIndicator } from './indicators/stellar.indicator';

@Module({
  imports: [
    TerminusModule,
    TypeOrmModule,
    CacheModule.register(),
  ],
  controllers: [HealthController],
  providers: [DatabaseIndicator, StellarIndicator],
  exports: [DatabaseIndicator, StellarIndicator],
})
export class HealthModule {}
