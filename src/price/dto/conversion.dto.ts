import { IsEnum, IsNumber, IsPositive } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum SupportedCurrency {
  XLM = 'XLM',
  USDC = 'USDC',
  USD = 'USD',
}

export class ConvertDto {
  @ApiProperty({ enum: SupportedCurrency, example: 'XLM' })
  @IsEnum(SupportedCurrency)
  from: SupportedCurrency;

  @ApiProperty({ enum: SupportedCurrency, example: 'USD' })
  @IsEnum(SupportedCurrency)
  to: SupportedCurrency;

  @ApiProperty({ example: 100 })
  @IsNumber()
  @IsPositive()
  amount: number;
}

export class ConversionResultDto {
  @ApiProperty() from: string;
  @ApiProperty() to: string;
  @ApiProperty() amount: number;
  @ApiProperty() result: number;
  @ApiProperty() rate: number;
  @ApiProperty() cachedAt: string;
}

export class RatesResponseDto {
  @ApiProperty() 
  XLM_USD: number;

  @ApiProperty() 
  USDC_USD: number;

  @ApiProperty() 
  XLM_USDC: number;

  @ApiProperty() 
  cachedAt: string;

  @ApiProperty() 
  source: 'live' | 'fallback';
}