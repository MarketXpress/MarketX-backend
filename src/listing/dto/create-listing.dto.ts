import { ListingVariantDto } from './listing-variant.dto';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

export class CreateListingDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price: number;

  @IsString()
  @IsNotEmpty()
  category: string;

  @IsString()
  @IsNotEmpty()
  location: string;

  // Legacy fallback fields for single-variant listings
  currency?: string;
  quantity?: number;
  reserved?: number;

  expiresAt?: Date;
  variants?: ListingVariantDto[];
}
