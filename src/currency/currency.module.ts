import { Module } from '@nestjs/common';
import { CurrencyService } from './currency.service';
import { ExchangeRateService } from './exchange-rate.service';
import { CurrencyController } from './currency.controller';
import { RedisCacheModule } from '../redis-caching/redis-cache.module';

@Module({
  imports: [RedisCacheModule],
  controllers: [CurrencyController],
  providers: [CurrencyService, ExchangeRateService],
  exports: [CurrencyService, ExchangeRateService],
})
export class CurrencyModule {}
