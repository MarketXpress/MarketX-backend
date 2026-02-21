import {
  IsString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsDate,
  IsArray,
  IsBoolean,
  Min,
  Max,
  Length,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DiscountType, CouponStatus } from '../entities/coupon.entity';

export class CouponRestrictionDto {
  @ApiPropertyOptional({ description: 'Product IDs eligible for this coupon' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  productIds?: string[];

  @ApiPropertyOptional({ description: 'Category IDs eligible for this coupon' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categoryIds?: string[];

  @ApiPropertyOptional({ description: 'Product IDs excluded from this coupon' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  excludedProductIds?: string[];

  @ApiPropertyOptional({ description: 'Category IDs excluded from this coupon' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  excludedCategoryIds?: string[];

  @ApiPropertyOptional({ description: 'Minimum order amount to apply coupon' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumOrderAmount?: number;

  @ApiPropertyOptional({ description: 'Maximum discount amount cap' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maximumDiscountAmount?: number;

  @ApiPropertyOptional({ description: 'Only for new customers' })
  @IsOptional()
  @IsBoolean()
  newCustomersOnly?: boolean;

  @ApiPropertyOptional({ description: 'Only for first order' })
  @IsOptional()
  @IsBoolean()
  firstOrderOnly?: boolean;
}

export class CreateCouponDto {
  @ApiProperty({ description: 'Unique coupon code', example: 'SUMMER2024' })
  @IsString()
  @Length(3, 50)
  code: string;

  @ApiProperty({ description: 'Coupon name', example: 'Summer Sale 2024' })
  @IsString()
  @Length(1, 255)
  name: string;

  @ApiPropertyOptional({ description: 'Coupon description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    enum: DiscountType,
    description: 'Type of discount',
    example: DiscountType.PERCENTAGE,
  })
  @IsEnum(DiscountType)
  discountType: DiscountType;

  @ApiProperty({
    description: 'Discount value (percentage or fixed amount)',
    example: 20,
  })
  @IsNumber()
  @Min(0)
  discountValue: number;

  @ApiPropertyOptional({
    enum: CouponStatus,
    description: 'Coupon status',
    default: CouponStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(CouponStatus)
  status?: CouponStatus;

  @ApiPropertyOptional({ description: 'Coupon validity start date' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  startDate?: Date;

  @ApiPropertyOptional({ description: 'Coupon validity end date' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  endDate?: Date;

  @ApiPropertyOptional({
    description: 'Total usage limit (0 = unlimited)',
    default: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalUsageLimit?: number;

  @ApiPropertyOptional({
    description: 'Per-user usage limit (0 = unlimited)',
    default: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  perUserLimit?: number;

  @ApiPropertyOptional({ description: 'Coupon restrictions' })
  @IsOptional()
  @ValidateNested()
  @Type(() => CouponRestrictionDto)
  restrictions?: CouponRestrictionDto;
}

export class UpdateCouponDto {
  @ApiPropertyOptional({ description: 'Coupon name' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  name?: string;

  @ApiPropertyOptional({ description: 'Coupon description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: CouponStatus })
  @IsOptional()
  @IsEnum(CouponStatus)
  status?: CouponStatus;

  @ApiPropertyOptional({ description: 'Coupon validity start date' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  startDate?: Date;

  @ApiPropertyOptional({ description: 'Coupon validity end date' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  endDate?: Date;

  @ApiPropertyOptional({ description: 'Total usage limit' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalUsageLimit?: number;

  @ApiPropertyOptional({ description: 'Per-user usage limit' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  perUserLimit?: number;

  @ApiPropertyOptional({ description: 'Coupon restrictions' })
  @IsOptional()
  @ValidateNested()
  @Type(() => CouponRestrictionDto)
  restrictions?: CouponRestrictionDto;
}
