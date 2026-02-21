import { EventEmitter2 } from '@nestjs/event-emitter';
import { PricingService, SupportedCurrency } from './services/pricing.service';
import { ProductsService } from './products.service';

describe('ProductsService price history & events', () => {
  let pricing: PricingService;
  let events: EventEmitter2;
  let products: ProductsService;

  beforeEach(() => {
    pricing = new PricingService();
    events = new EventEmitter2();
    const mediaService = { deleteProductImages: jest.fn().mockResolvedValue(true) } as any;
    products = new ProductsService(pricing, events, mediaService);
  });

  it('create stores decimal and minor strings and includes rate snapshot in history', () => {
    const dto: any = {
      name: 'T',
      category: 'c',
      basePrice: 12.34,
      baseCurrency: SupportedCurrency.USD,
      images: ['http://x/1.jpg'],
    };

    const p = products.create('seller-1', dto as any);
    expect(p.basePrice).toBe('12.34');
    expect(p.basePriceMinor).toBe('1234');
    expect(p.priceHistory.length).toBeGreaterThan(0);
    const entry = p.priceHistory[0];
    expect(entry.basePrice).toBe('12.34');
    expect(entry.basePriceMinor).toBe('1234');
    expect(entry.rateSnapshot).toBeDefined();
    expect(entry.rateTimestamp).toBeDefined();
  });

  it('updatePrice pushes history and emits enriched event', async () => {
    const dto: any = {
      name: 'T',
      category: 'c',
      basePrice: 12.34,
      baseCurrency: SupportedCurrency.USD,
      images: ['http://x/1.jpg'],
    };

    const p = products.create('seller-1', dto);
    let payload: any = null;
    events.on('product.price.updated', (pl) => (payload = pl));

    const updated = products.updatePrice(p.id, 'seller-1', { basePrice: 15.5, baseCurrency: SupportedCurrency.USD, reason: 'test' });

    expect(updated.price).toBe('15.5');
    expect(updated.priceMinor).toBe(pricing.toMinorUnitsString(15.5, SupportedCurrency.USD));
    expect(updated.priceHistory.length).toBe(2);
    const last = updated.priceHistory[updated.priceHistory.length - 1];
    expect(last.basePrice).toBe('15.5');
    expect(last.basePriceMinor).toBe(pricing.toMinorUnitsString(15.5, SupportedCurrency.USD));
    expect(last.rateSnapshot).toBeDefined();
    expect(payload).not.toBeNull();
    expect(payload.basePrice).toBe(updated.basePrice);
    expect(payload.basePriceMinor).toBe(updated.basePriceMinor);
  });
});
