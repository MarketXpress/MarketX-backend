import { IsEnum, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { SupportedCurrency } from '../services/pricing.service';

export class UpdatePriceDto {
  @IsNumber()
  @Min(0)
  @Max(1000000000)
  basePrice: number;

  @IsEnum(SupportedCurrency)
  baseCurrency: SupportedCurrency;

  @IsOptional()
  @IsString()
  reason?: string;
}
