import { SupportedCurrency } from '../services/pricing.service';

export interface ProductPriceHistoryEntry {
  id: string;
  // Decimal string representation, safe for JSON and audit
  basePrice: string;
  // Minor units integer stored as string to preserve full precision for DB/blockchain
  basePriceMinor: string;
  baseCurrency: SupportedCurrency;
  changedAt: Date;
  // Snapshot of relevant exchange rates (USD-based) at the time of change
  rateSnapshot?: Record<SupportedCurrency, string>;
  // ISO timestamp of when the rate snapshot was taken
  rateTimestamp?: string;
  updatedBy?: string;
  reason?: string;
}

export interface Product {
  id: string;
  sellerId: string;
  name: string;
  category: string;
  // Decimal string for human/readable prices
  basePrice: string;
  // Minor units as string for deterministic calculations and storage
  basePriceMinor: string;
  baseCurrency: SupportedCurrency;
  // Current listing price (decimal string) and its minor units
  price: string;
  priceMinor: string;
  currency: SupportedCurrency;
  description?: string;
  images: string[];
  createdAt: Date;
  updatedAt: Date;
  priceHistory: ProductPriceHistoryEntry[];
}
