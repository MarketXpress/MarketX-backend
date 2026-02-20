import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import axios from 'axios';
import { PriceCache } from './interfaces/price-cache.interface';
import { SupportedCurrency } from './dto/conversion.dto';

@Injectable()
export class PriceService {
  private readonly logger = new Logger(PriceService.name);

  private cache: PriceCache = {
    XLM_USD: 0,
    USDC_USD: 1,
    lastUpdated: new Date(0),
  };

  private readonly TTL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.updateRates(); // initial load
  }

  // =========================
  // Scheduled update (5 mins)
  // =========================
  @Cron('*/5 * * * *')
  async handleCron() {
    await this.updateRates();
  }

  // =========================
  // Fetch from CoinGecko
  // =========================
  async updateRates() {
    try {
      const response = await axios.get(
        'https://api.coingecko.com/api/v3/simple/price',
        {
          params: {
            ids: 'stellar,usd-coin',
            vs_currencies: 'usd',
          },
        },
      );

      const data = response.data;

      this.cache = {
        XLM_USD: data.stellar.usd,
        USDC_USD: data['usd-coin'].usd,
        lastUpdated: new Date(),
      };

      this.logger.log('Price rates updated successfully');
    } catch (error) {
      this.logger.error(
        'Failed to update price rates. Using last known rates.',
      );
    }
  }

  // =========================
  // Get Current Rates
  // =========================
  async getRates() {
    const now = Date.now();

    if (now - this.cache.lastUpdated.getTime() > this.TTL) {
      await this.updateRates();
    }

    return this.cache;
  }

  // =========================
  // Conversion Logic
  // =========================
  async convert(
    from: SupportedCurrency,
    to: SupportedCurrency,
    amount: number,
  ) {
    const rates = await this.getRates();

    const usdValue = this.toUSD(from, amount, rates);
    const converted = this.fromUSD(to, usdValue, rates);

    return {
      from,
      to,
      originalAmount: amount,
      convertedAmount: converted,
      rateTimestamp: rates.lastUpdated,
    };
  }

  private toUSD(
    currency: SupportedCurrency,
    amount: number,
    rates: PriceCache,
  ): number {
    switch (currency) {
      case SupportedCurrency.XLM:
        return amount * rates.XLM_USD;
      case SupportedCurrency.USDC:
        return amount * rates.USDC_USD;
      case SupportedCurrency.USD:
        return amount;
    }
  }

  private fromUSD(
    currency: SupportedCurrency,
    usdAmount: number,
    rates: PriceCache,
  ): number {
    switch (currency) {
      case SupportedCurrency.XLM:
        return usdAmount / rates.XLM_USD;
      case SupportedCurrency.USDC:
        return usdAmount / rates.USDC_USD;
      case SupportedCurrency.USD:
        return usdAmount;
    }
  }
}