import { BadRequestException } from '@nestjs/common';
import { PricingService, SupportedCurrency } from './pricing.service';

describe('PricingService', () => {
  let service: PricingService;

  beforeEach(() => {
    service = new PricingService();
  });

  it('converts USD to XLM with configured precision', () => {
    const result = service.convertAmount(12.34, SupportedCurrency.USD, SupportedCurrency.XLM);
    expect(result).toBe(102.8333333);
  });

  it('keeps precision for XLM -> USD round conversion within currency rounding bounds', () => {
    const xlm = 10.1234567;
    const usd = service.convertAmount(xlm, SupportedCurrency.XLM, SupportedCurrency.USD);
    const backToXlm = service.convertAmount(usd, SupportedCurrency.USD, SupportedCurrency.XLM);
    expect(usd).toBe(1.21);
    expect(backToXlm).toBe(10.0833333);
  });

  it('rejects unsupported decimal precision per currency', () => {
    expect(() => service.validatePrice(1.123, SupportedCurrency.USD)).toThrow(
      BadRequestException,
    );
  });

  it('rejects out-of-range prices', () => {
    expect(() => service.validatePrice(0, SupportedCurrency.USDC)).toThrow(BadRequestException);
  });
});
