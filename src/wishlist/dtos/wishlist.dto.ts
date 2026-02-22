import {
  IsString,
  IsBoolean,
  IsOptional,
  IsNumber,
  IsPositive,
  MaxLength,
  IsUrl,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateWishlistDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

export class UpdateWishlistDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

export class AddWishlistItemDto {
  @IsString()
  productId: string;

  @IsString()
  @MaxLength(255)
  productName: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Type(() => Number)
  currentPrice: number;

  @IsOptional()
  @IsUrl()
  productImageUrl?: string;

  @IsOptional()
  @IsUrl()
  productUrl?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Type(() => Number)
  priceAlertThreshold?: number;

  @IsOptional()
  @IsBoolean()
  notificationsEnabled?: boolean;
}

export class UpdateWishlistItemDto {
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Type(() => Number)
  priceAlertThreshold?: number;

  @IsOptional()
  @IsBoolean()
  notificationsEnabled?: boolean;
}