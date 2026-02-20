import { IsEnum, IsNumber } from 'class-validator';

export enum SupportedCurrency {
  XLM = 'XLM',
  USDC = 'USDC',
  USD = 'USD',
}

export class ConversionDto {
  @IsEnum(SupportedCurrency)
  from: SupportedCurrency;

  @IsEnum(SupportedCurrency)
  to: SupportedCurrency;

  @IsNumber()
  amount: number;
}