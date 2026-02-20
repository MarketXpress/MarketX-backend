import { BadRequestException, Injectable } from '@nestjs/common';

export enum SupportedCurrency {
  XLM = 'XLM',
  USDC = 'USDC',
  USD = 'USD',
}

type DecimalValue = {
  int: bigint;
  scale: number;
};

@Injectable()
export class PricingService {
  private readonly precisionByCurrency: Record<SupportedCurrency, number> = {
    [SupportedCurrency.XLM]: 7,
    [SupportedCurrency.USDC]: 2,
    [SupportedCurrency.USD]: 2,
  };

  private readonly minPriceByCurrency: Record<SupportedCurrency, string> = {
    [SupportedCurrency.XLM]: '0.0000001',
    [SupportedCurrency.USDC]: '0.01',
    [SupportedCurrency.USD]: '0.01',
  };

  private readonly maxPriceByCurrency: Record<SupportedCurrency, string> = {
    [SupportedCurrency.XLM]: '1000000000',
    [SupportedCurrency.USDC]: '1000000000',
    [SupportedCurrency.USD]: '1000000000',
  };

  private readonly usdRateByCurrency: Record<SupportedCurrency, string> = {
    [SupportedCurrency.XLM]: '0.1200000',
    [SupportedCurrency.USDC]: '1',
    [SupportedCurrency.USD]: '1',
  };

  getCurrencyPrecision(currency: SupportedCurrency): number {
    return this.precisionByCurrency[currency];
  }

  validatePrice(amount: number, currency: SupportedCurrency): void {
    const amountString = this.normalizeNumberString(amount);
    const scale = this.getScale(amountString);
    const maxScale = this.getCurrencyPrecision(currency);

    if (scale > maxScale) {
      throw new BadRequestException(
        `Invalid precision for ${currency}. Maximum ${maxScale} decimal places are allowed.`,
      );
    }

    const amountMinor = this.toMinorUnitsFromString(amountString, currency);
    const minMinor = this.toMinorUnitsFromString(this.minPriceByCurrency[currency], currency);
    const maxMinor = this.toMinorUnitsFromString(this.maxPriceByCurrency[currency], currency);

    if (amountMinor < minMinor || amountMinor > maxMinor) {
      throw new BadRequestException(
        `Price for ${currency} must be between ${this.minPriceByCurrency[currency]} and ${this.maxPriceByCurrency[currency]}.`,
      );
    }
  }

  convertAmount(
    amount: number,
    sourceCurrency: SupportedCurrency,
    targetCurrency: SupportedCurrency,
  ): number {
    this.validateAmountForConversion(amount, sourceCurrency);

    if (sourceCurrency === targetCurrency) {
      return this.roundToCurrency(amount, targetCurrency);
    }

    const sourceMinor = this.toMinorUnits(amount, sourceCurrency);
    const targetMinor = this.convertMinorUnits(
      sourceMinor,
      sourceCurrency,
      targetCurrency,
    );

    return this.fromMinorUnits(targetMinor, targetCurrency);
  }

  getConversionRate(
    sourceCurrency: SupportedCurrency,
    targetCurrency: SupportedCurrency,
  ): number {
    if (sourceCurrency === targetCurrency) {
      return 1;
    }

    const oneSourceUnitMinor = this.pow10(this.getCurrencyPrecision(sourceCurrency));
    const convertedMinor = this.convertMinorUnits(
      oneSourceUnitMinor,
      sourceCurrency,
      targetCurrency,
    );

    return this.fromMinorUnits(convertedMinor, targetCurrency);
  }

  roundToCurrency(amount: number, currency: SupportedCurrency): number {
    const minor = this.toMinorUnits(amount, currency);
    return this.fromMinorUnits(minor, currency);
  }

  toMinorUnits(amount: number, currency: SupportedCurrency): bigint {
    return this.toMinorUnitsFromString(this.normalizeNumberString(amount), currency);
  }

  fromMinorUnits(amountMinor: bigint, currency: SupportedCurrency): number {
    const precision = this.getCurrencyPrecision(currency);
    const negative = amountMinor < 0n;
    const absolute = negative ? -amountMinor : amountMinor;
    const base = this.pow10(precision);
    const integer = absolute / base;
    const fractional = absolute % base;
    const fractionalString =
      precision > 0 ? fractional.toString().padStart(precision, '0') : '';
    const value =
      precision > 0 ? `${integer.toString()}.${fractionalString}` : integer.toString();

    return Number(negative ? `-${value}` : value);
  }

  multiplyAmount(amount: number, quantity: number, currency: SupportedCurrency): number {
    const amountMinor = this.toMinorUnits(amount, currency);
    return this.fromMinorUnits(amountMinor * BigInt(quantity), currency);
  }

  addAmounts(amounts: number[], currency: SupportedCurrency): number {
    const totalMinor = amounts.reduce((total, value) => {
      return total + this.toMinorUnits(value, currency);
    }, 0n);

    return this.fromMinorUnits(totalMinor, currency);
  }

  private normalizeNumberString(value: number): string {
    if (!Number.isFinite(value)) {
      throw new BadRequestException('Price must be a finite number.');
    }

    const normalized = value.toString();
    if (!normalized.includes('e') && !normalized.includes('E')) {
      return normalized;
    }

    return value.toFixed(12).replace(/0+$/, '').replace(/\.$/, '');
  }

  private validateAmountForConversion(amount: number, currency: SupportedCurrency): void {
    const amountString = this.normalizeNumberString(amount);
    const scale = this.getScale(amountString);
    const maxScale = this.getCurrencyPrecision(currency);

    if (scale > maxScale) {
      throw new BadRequestException(
        `Invalid precision for ${currency}. Maximum ${maxScale} decimal places are allowed.`,
      );
    }
  }

  private getScale(value: string): number {
    const decimal = value.split('.')[1];
    return decimal ? decimal.length : 0;
  }

  private parseDecimal(value: string): DecimalValue {
    const negative = value.startsWith('-');
    const clean = negative ? value.slice(1) : value;
    const [integerPartRaw, fractionPartRaw = ''] = clean.split('.');
    const integerPart = integerPartRaw || '0';
    const fractionPart = fractionPartRaw || '';
    const combined = `${integerPart}${fractionPart}`.replace(/^0+(?=\d)/, '') || '0';
    const int = BigInt(combined);

    return {
      int: negative ? -int : int,
      scale: fractionPart.length,
    };
  }

  private toMinorUnitsFromString(value: string, currency: SupportedCurrency): bigint {
    const decimal = this.parseDecimal(value);
    const targetScale = this.getCurrencyPrecision(currency);
    const exponent = targetScale - decimal.scale;

    if (exponent >= 0) {
      return decimal.int * this.pow10(exponent);
    }

    return this.divideWithHalfUp(decimal.int, this.pow10(-exponent));
  }

  private convertMinorUnits(
    sourceMinor: bigint,
    sourceCurrency: SupportedCurrency,
    targetCurrency: SupportedCurrency,
  ): bigint {
    const sourceRate = this.parseDecimal(this.usdRateByCurrency[sourceCurrency]);
    const targetRate = this.parseDecimal(this.usdRateByCurrency[targetCurrency]);
    const sourceScale = this.getCurrencyPrecision(sourceCurrency);
    const targetScale = this.getCurrencyPrecision(targetCurrency);

    const exponent = targetRate.scale + targetScale - sourceScale - sourceRate.scale;
    const numeratorMultiplier = exponent >= 0 ? this.pow10(exponent) : 1n;
    const denominatorMultiplier = exponent < 0 ? this.pow10(-exponent) : 1n;

    const numerator = sourceMinor * sourceRate.int * numeratorMultiplier;
    const denominator = targetRate.int * denominatorMultiplier;

    if (denominator === 0n) {
      throw new BadRequestException('Invalid conversion rate configuration.');
    }

    return this.divideWithHalfUp(numerator, denominator);
  }

  private divideWithHalfUp(numerator: bigint, denominator: bigint): bigint {
    const quotient = numerator / denominator;
    const remainder = numerator % denominator;

    if (remainder === 0n) {
      return quotient;
    }

    const absRemainder = remainder < 0n ? -remainder : remainder;
    const absDenominator = denominator < 0n ? -denominator : denominator;
    const shouldRoundUp = absRemainder * 2n >= absDenominator;

    if (!shouldRoundUp) {
      return quotient;
    }

    const sign = numerator >= 0n ? 1n : -1n;
    return quotient + sign;
  }

  private pow10(power: number): bigint {
    if (power <= 0) {
      return 1n;
    }
    return 10n ** BigInt(power);
  }
}
