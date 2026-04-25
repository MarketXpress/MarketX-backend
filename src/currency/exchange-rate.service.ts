import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { RedisCacheService } from '../redis-caching/redis-cache.service';
import axios from 'axios';

export const SUPPORTED_CURRENCIES = [
  'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'INR', 'XLM', 'USDC'
] as const;

export type Currency = typeof SUPPORTED_CURRENCIES[number];

interface ExchangeRates {
  base: string;
  rates: Record<string, number>;
  timestamp: string;
}

@Injectable()
export class ExchangeRateService {
  private readonly logger = new Logger(ExchangeRateService.name);
  private readonly CACHE_KEY = 'exchange_rates:usd';
  private readonly CACHE_TTL = 14400; // 4 hours in seconds
  private readonly API_URL = 'https://api.frankfurter.app/latest';

  constructor(private readonly cache: RedisCacheService) {}

  @Cron('0 */4 * * *') // Every 4 hours
  async refreshRates(): Promise<void> {
    try {
      this.logger.log('Fetching exchange rates from Frankfurter API...');
      
      const { data } = await axios.get<ExchangeRates>(this.API_URL, {
        params: { from: 'USD' },
        timeout: 10000,
      });

      const rates: Record<string, number> = {
        USD: 1,
        ...data.rates,
      };

      await this.cache.set(this.CACHE_KEY, rates, this.CACHE_TTL);
      this.logger.log(`Exchange rates updated: ${Object.keys(rates).length} currencies`);
    } catch (error) {
      this.logger.error(`Failed to fetch exchange rates: ${error.message}`);
    }
  }

  async getRates(): Promise<Record<string, number>> {
    const cached = await this.cache.get<Record<string, number>>(this.CACHE_KEY);
    
    if (cached) {
      return cached;
    }

    await this.refreshRates();
    return await this.cache.get<Record<string, number>>(this.CACHE_KEY) || this.getFallbackRates();
  }

  private getFallbackRates(): Record<string, number> {
    return {
      USD: 1,
      EUR: 0.92,
      GBP: 0.79,
      JPY: 149.5,
      CAD: 1.36,
      AUD: 1.52,
      CHF: 0.88,
      CNY: 7.24,
      INR: 83.12,
      XLM: 0.12,
      USDC: 1.0,
    };
  }
}
