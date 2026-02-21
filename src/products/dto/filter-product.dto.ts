
import { IsOptional, IsString, IsNumber, Min, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { SupportedCurrency } from '../services/pricing.service';

export class FilterProductDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  limit = 10;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  offset = 0;

  @IsOptional()
  @IsEnum(SupportedCurrency)
  preferredCurrency?: SupportedCurrency;
}
