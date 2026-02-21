import { SupportedCurrency } from '../services/pricing.service';

export interface ProductPriceHistoryEntry {
  id: string;
  basePrice: number;
  baseCurrency: SupportedCurrency;
  changedAt: Date;
  updatedBy?: string;
  reason?: string;
}

export interface Product {
  id: string;
  sellerId: string;
  name: string;
  category: string;
  basePrice: number;
  baseCurrency: SupportedCurrency;
  price: number;
  currency: SupportedCurrency;
  description?: string;
  images: string[];
  createdAt: Date;
  updatedAt: Date;
  priceHistory: ProductPriceHistoryEntry[];
}
