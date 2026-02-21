import { PricingService, SupportedCurrency } from './pricing.service';

describe('PricingService string/minor helpers', () => {
  let service: PricingService;

  beforeEach(() => {
    service = new PricingService();
  });

  it('toMinorUnitsString and fromMinorUnitsToDecimalString round-trip for USD', () => {
    const minor = service.toMinorUnitsString(12.34, SupportedCurrency.USD);
    expect(minor).toBe('1234');

    const decimal = service.fromMinorUnitsToDecimalString(BigInt(minor), SupportedCurrency.USD);
    expect(decimal).toBe('12.34');
  });

  it('convertAmountToString produces deterministic XLM result', () => {
    const converted = service.convertAmountToString(12.34, SupportedCurrency.USD, SupportedCurrency.XLM);
    // known result from numeric conversion tests
    expect(converted).toBe('102.8333333');
  });

  it('getRateSnapshot returns rates and timestamp', () => {
    const snap = service.getRateSnapshot();
    expect(typeof snap.timestamp).toBe('string');
    expect(snap.rates).toHaveProperty(SupportedCurrency.XLM);
    expect(snap.rates).toHaveProperty(SupportedCurrency.USDC);
  });
});
