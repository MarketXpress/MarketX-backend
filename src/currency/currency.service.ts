import { Injectable, BadRequestException } from '@nestjs/common';
import { ExchangeRateService, Currency } from './exchange-rate.service';

@Injectable()
export class CurrencyService {
  constructor(private readonly exchangeRateService: ExchangeRateService) {}

  async convert(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
  ): Promise<{ amount: number; rate: number }> {
    if (fromCurrency === toCurrency) {
      return { amount, rate: 1 };
    }

    const rates = await this.exchangeRateService.getRates();

    const fromRate = rates[fromCurrency];
    const toRate = rates[toCurrency];

    if (!fromRate || !toRate) {
      throw new BadRequestException(
        `Unsupported currency: ${!fromRate ? fromCurrency : toCurrency}`,
      );
    }

    const amountInUSD = amount / fromRate;
    const convertedAmount = amountInUSD * toRate;
    const rate = toRate / fromRate;

    return {
      amount: parseFloat(convertedAmount.toFixed(2)),
      rate: parseFloat(rate.toFixed(6)),
    };
  }

  async convertBatch(
    items: Array<{ amount: number; currency: string }>,
    toCurrency: string,
  ): Promise<number> {
    const rates = await this.exchangeRateService.getRates();
    
    let totalInUSD = 0;
    for (const item of items) {
      const fromRate = rates[item.currency] || 1;
      totalInUSD += item.amount / fromRate;
    }

    const toRate = rates[toCurrency] || 1;
    return parseFloat((totalInUSD * toRate).toFixed(2));
  }
}
