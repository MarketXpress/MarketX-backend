import {
  IsString,
  IsNumber,
  IsArray,
  IsOptional,
  IsPositive,
  IsUrl,
  ArrayNotEmpty,
  IsEnum,
  Max,
} from 'class-validator';
import { SupportedCurrency } from '../services/pricing.service';

export class CreateProductDto {
  @IsString()
  name: string;

  @IsString()
  category: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Max(1000000000)
  price?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Max(1000000000)
  basePrice?: number;

  @IsOptional()
  @IsEnum(SupportedCurrency)
  currency?: SupportedCurrency;

  @IsOptional()
  @IsEnum(SupportedCurrency)
  baseCurrency?: SupportedCurrency;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsUrl({}, { each: true })
  images: string[];
}
