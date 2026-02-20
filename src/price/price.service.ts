import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import axios from 'axios';
import { SupportedCurrency } from './dto/conversion.dto';

interface RateCache {
  XLM_USD: number;
  USDC_USD: number;
  XLM_USDC: number;
  cachedAt: Date;
  source: 'live' | 'fallback';
}

@Injectable()
export class PriceService implements OnModuleInit {
  private readonly logger = new Logger(PriceService.name);
  private cache: RateCache | null = null;
  private lastKnownRates: RateCache | null = null;

  // Fallback hardcoded rates used only if no live/cached data ever loads
  private readonly FALLBACK_RATES = {
    XLM_USD: 0.11,
    USDC_USD: 1.0,
    XLM_USDC: 0.11,
  };

  private readonly COINGECKO_URL =
    'https://api.coingecko.com/api/v3/simple/price';

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    await this.refreshRates();
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async refreshRates(): Promise<void> {
    try {
      this.logger.log('Fetching latest crypto rates from CoinGecko...');

      const apiKey = this.configService.get<string>('COINGECKO_API_KEY');
      const headers: Record<string, string> = apiKey
        ? { 'x-cg-demo-api-key': apiKey }
        : {};

      const { data } = await axios.get<Record<string, { usd: number }>>(this.COINGECKO_URL, {
        headers,
        params: {
          ids: 'stellar,usd-coin',
          vs_currencies: 'usd',
        },
        timeout: 10000,
      });

      const xlmUsd: number = data['stellar']['usd'];
      const usdcUsd: number = data['usd-coin']['usd'];

      const rates: RateCache = {
        XLM_USD: xlmUsd,
        USDC_USD: usdcUsd,
        XLM_USDC: xlmUsd / usdcUsd,
        cachedAt: new Date(),
        source: 'live',
      };

      this.cache = rates;
      this.lastKnownRates = rates;
      this.logger.log(
        `Rates updated — XLM: $${xlmUsd}, USDC: $${usdcUsd}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to fetch rates: ${error.message}. Using fallback.`,
      );
      this.useFallback();
    }
  }

  private useFallback(): void {
    if (this.lastKnownRates) {
      this.cache = { ...this.lastKnownRates, source: 'fallback' };
      this.logger.warn('Using last known rates as fallback');
    } else {
      this.cache = {
        ...this.FALLBACK_RATES,
        cachedAt: new Date(),
        source: 'fallback',
      };
      this.logger.warn('Using hardcoded fallback rates — no live data ever loaded');
    }
  }

  getRates(): RateCache {
    if (!this.cache) {
      this.useFallback();
    }
    return this.cache!;
  }

  convert(from: SupportedCurrency, to: SupportedCurrency, amount: number) {
    const rates = this.getRates();

    if (from === to) {
      return { result: amount, rate: 1, ...rates };
    }

    // Convert everything through USD as the base
    const toUsd: Record<SupportedCurrency, number> = {
      [SupportedCurrency.USD]: 1,
      [SupportedCurrency.XLM]: rates.XLM_USD,
      [SupportedCurrency.USDC]: rates.USDC_USD,
    };

    const fromUsd = toUsd[from];
    const toUsdRate = toUsd[to];

    const rate = fromUsd / toUsdRate;
    const result = amount * rate;

    return {
      result: parseFloat(result.toFixed(6)),
      rate: parseFloat(rate.toFixed(6)),
      cachedAt: rates.cachedAt,
      source: rates.source,
    };
  }
}