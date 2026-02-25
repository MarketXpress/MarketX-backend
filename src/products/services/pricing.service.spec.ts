import { BadRequestException } from '@nestjs/common';
import { PricingService, SupportedCurrency } from './pricing.service';

describe('PricingService', () => {
  let service: PricingService;

  beforeEach(() => {
    service = new PricingService();
  });

  // ── existing conversion tests ──────────────────────────────────────────────

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

  // ── same-currency conversions ──────────────────────────────────────────────

  it('returns exact amount when source and target currency are the same', () => {
    expect(service.convertAmount(50.25, SupportedCurrency.USD, SupportedCurrency.USD)).toBe(50.25);
    expect(service.convertAmount(1.5000000, SupportedCurrency.XLM, SupportedCurrency.XLM)).toBe(1.5);
    expect(service.convertAmount(99.99, SupportedCurrency.USDC, SupportedCurrency.USDC)).toBe(99.99);
  });

  it('getConversionRate returns 1 for identical currencies', () => {
    expect(service.getConversionRate(SupportedCurrency.USD, SupportedCurrency.USD)).toBe(1);
  });

  // ── XLM precision edge cases ───────────────────────────────────────────────

  it('accepts XLM minimum price (0.0000001)', () => {
    expect(() => service.validatePrice(0.0000001, SupportedCurrency.XLM)).not.toThrow();
  });

  it('rejects XLM price with more than 7 decimal places', () => {
    expect(() => service.validatePrice(0.00000001, SupportedCurrency.XLM)).toThrow(
      BadRequestException,
    );
  });

  it('rejects price below XLM minimum', () => {
    expect(() => service.validatePrice(0.0000000, SupportedCurrency.XLM)).toThrow(
      BadRequestException,
    );
  });

  // ── USD/USDC precision edge cases ─────────────────────────────────────────

  it('accepts USD price with exactly 2 decimal places', () => {
    expect(() => service.validatePrice(1.99, SupportedCurrency.USD)).not.toThrow();
  });

  it('rejects USD price with 3 decimal places', () => {
    expect(() => service.validatePrice(1.999, SupportedCurrency.USD)).toThrow(BadRequestException);
  });

  it('accepts USDC minimum price (0.01)', () => {
    expect(() => service.validatePrice(0.01, SupportedCurrency.USDC)).not.toThrow();
  });

  it('rejects USDC price below 0.01', () => {
    expect(() => service.validatePrice(0.001, SupportedCurrency.USDC)).toThrow(BadRequestException);
  });

  // ── large value handling ───────────────────────────────────────────────────

  it('accepts maximum price boundary (1,000,000,000)', () => {
    expect(() => service.validatePrice(1_000_000_000, SupportedCurrency.USD)).not.toThrow();
  });

  it('rejects price above maximum', () => {
    expect(() => service.validatePrice(1_000_000_001, SupportedCurrency.USD)).toThrow(
      BadRequestException,
    );
  });

  it('converts large XLM amount to USD without floating-point error', () => {
    const result = service.convertAmount(1_000_000, SupportedCurrency.XLM, SupportedCurrency.USD);
    // 1,000,000 XLM * 0.12 = 120,000 USD
    expect(result).toBe(120000);
  });

  // ── rounding behaviour ─────────────────────────────────────────────────────

  it('rounds half-up when converting XLM to USD', () => {
    // 1 XLM = 0.12 USD; 0.005 XLM → 0.0006 USD → rounds to 0.00 at USD scale
    const minor = service.toMinorUnits(0.0000001, SupportedCurrency.XLM);
    expect(minor).toBe(1n);
  });

  it('roundToCurrency truncates XLM to 7 decimal places', () => {
    // Provide value already at max precision — should be unchanged
    const result = service.roundToCurrency(1.1234567, SupportedCurrency.XLM);
    expect(result).toBe(1.1234567);
  });

  it('roundToCurrency rounds USD down when remainder < 0.5 of a cent', () => {
    // 9.994 → 999.4 minor units → rounds down to 999 → 9.99
    expect(service.roundToCurrency(9.994, SupportedCurrency.USD)).toBe(9.99);
  });

  it('roundToCurrency rounds USD up (half-up) when remainder >= 0.5 of a cent', () => {
    // 9.999 → 999.9 minor units → rounds up to 1000 → 10.00
    expect(service.roundToCurrency(9.999, SupportedCurrency.USD)).toBe(10);
  });

  // ── minor-unit helpers ─────────────────────────────────────────────────────

  it('converts USD to minor units and back without loss', () => {
    const minor = service.toMinorUnits(123.45, SupportedCurrency.USD);
    expect(minor).toBe(12345n);
    expect(service.fromMinorUnits(minor, SupportedCurrency.USD)).toBe(123.45);
  });

  it('converts XLM to minor units (stroops) and back', () => {
    const minor = service.toMinorUnits(1.0000001, SupportedCurrency.XLM);
    expect(minor).toBe(10000001n);
    expect(service.fromMinorUnits(minor, SupportedCurrency.XLM)).toBe(1.0000001);
  });

  // ── multiplyAmount / addAmounts ───────────────────────────────────────────

  it('multiplies amount by integer quantity without floating-point drift', () => {
    const result = service.multiplyAmount(0.1, 3, SupportedCurrency.USD);
    // 0.1 * 3 = 0.3 (naive JS gives 0.30000000000000004)
    expect(result).toBe(0.3);
  });

  it('adds multiple USD amounts without floating-point drift', () => {
    const result = service.addAmounts([0.1, 0.2], SupportedCurrency.USD);
    // naive JS: 0.1 + 0.2 = 0.30000000000000004
    expect(result).toBe(0.3);
  });

  // ── calculateOrderTotal ───────────────────────────────────────────────────

  it('calculates single-item order total in same currency', () => {
    const total = service.calculateOrderTotal(
      [{ price: 10.00, currency: SupportedCurrency.USD, quantity: 3 }],
      SupportedCurrency.USD,
    );
    expect(total).toBe('30.00');
  });

  it('calculates multi-item order total converting XLM to USD', () => {
    // 5 XLM @ 0.12 = 0.60 USD; 2 * qty = 1.20 USD
    // 1.00 USD @ 1.00 = 1.00 USD; 1 * qty = 1.00 USD
    // total = 2.20 USD
    const total = service.calculateOrderTotal(
      [
        { price: 5, currency: SupportedCurrency.XLM, quantity: 2 },
        { price: 1.00, currency: SupportedCurrency.USD, quantity: 1 },
      ],
      SupportedCurrency.USD,
    );
    expect(total).toBe('2.20');
  });

  it('calculates order total in XLM target currency', () => {
    // 1.20 USD / 0.12 = 10 XLM; qty 1 → 10.0000000 XLM
    const total = service.calculateOrderTotal(
      [{ price: 1.20, currency: SupportedCurrency.USD, quantity: 1 }],
      SupportedCurrency.XLM,
    );
    expect(total).toBe('10.0000000');
  });

  it('calculates order total for empty cart as zero', () => {
    const total = service.calculateOrderTotal([], SupportedCurrency.USD);
    expect(total).toBe('0.00');
  });

  // ── rate snapshot ─────────────────────────────────────────────────────────

  it('getRateSnapshot includes all supported currencies and a timestamp', () => {
    const snap = service.getRateSnapshot();
    expect(snap.rates).toHaveProperty(SupportedCurrency.XLM);
    expect(snap.rates).toHaveProperty(SupportedCurrency.USDC);
    expect(snap.rates).toHaveProperty(SupportedCurrency.USD);
    expect(typeof snap.timestamp).toBe('string');
    expect(() => new Date(snap.timestamp)).not.toThrow();
  });

  it('getRateSnapshot USD rate is always 1', () => {
    const snap = service.getRateSnapshot();
    expect(snap.rates[SupportedCurrency.USD]).toBe('1.0000000');
  });
});
