import { SupportedCurrency } from '../services/pricing.service';

export interface ProductPriceHistoryEntry {
  id: string;

  basePrice: string;

  basePriceMinor: string;

  baseCurrency: SupportedCurrency;

  changedAt: Date;

  rateSnapshot?: Record<SupportedCurrency, string>;

  rateTimestamp?: string;

  updatedBy?: string;

  reason?: string;
}

export interface Product {
  id: string;

  sellerId: string;

  name: string;

  category: string;

  basePrice: string;

  basePriceMinor: string;

  baseCurrency: SupportedCurrency;

  price: string;

  priceMinor: string;

  currency: SupportedCurrency;

  description?: string;

  images: string[];

  createdAt: Date;

  updatedAt: Date;

  priceHistory: ProductPriceHistoryEntry[];

  /**
   * Present on display/read responses.
   */
  convertedPrice?: number;

  convertedPriceString?: string;

  convertedCurrency?: SupportedCurrency;

  conversionRate?: number;

  displayPrice?: string;
}
