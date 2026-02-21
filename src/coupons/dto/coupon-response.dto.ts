import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DiscountType, CouponStatus } from '../entities/coupon.entity';

export class CouponRestrictionResponseDto {
  @ApiPropertyOptional()
  productIds?: string[];

  @ApiPropertyOptional()
  categoryIds?: string[];

  @ApiPropertyOptional()
  excludedProductIds?: string[];

  @ApiPropertyOptional()
  excludedCategoryIds?: string[];

  @ApiPropertyOptional()
  minimumOrderAmount?: number;

  @ApiPropertyOptional()
  maximumDiscountAmount?: number;

  @ApiPropertyOptional()
  newCustomersOnly?: boolean;

  @ApiPropertyOptional()
  firstOrderOnly?: boolean;
}

export class CouponResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  code: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty({ enum: DiscountType })
  discountType: DiscountType;

  @ApiProperty()
  discountValue: number;

  @ApiProperty({ enum: CouponStatus })
  status: CouponStatus;

  @ApiPropertyOptional()
  startDate?: Date;

  @ApiPropertyOptional()
  endDate?: Date;

  @ApiProperty()
  totalUsageLimit: number;

  @ApiProperty()
  perUserLimit: number;

  @ApiProperty()
  currentUsageCount: number;

  @ApiPropertyOptional({ type: CouponRestrictionResponseDto })
  restrictions?: CouponRestrictionResponseDto;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  isValid: boolean;

  @ApiProperty()
  remainingUses: number;
}

export class CouponUsageResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  couponId: string;

  @ApiProperty()
  couponCode: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  orderId: string;

  @ApiProperty()
  orderAmount: number;

  @ApiProperty()
  discountAmount: number;

  @ApiProperty()
  currency: string;

  @ApiProperty()
  usedAt: Date;
}

export class CouponAnalyticsDto {
  @ApiProperty()
  couponId: string;

  @ApiProperty()
  couponCode: string;

  @ApiProperty()
  totalUses: number;

  @ApiProperty()
  totalDiscountAmount: number;

  @ApiProperty()
  averageOrderAmount: number;

  @ApiProperty()
  averageDiscountAmount: number;

  @ApiProperty()
  uniqueUsers: number;

  @ApiProperty()
  conversionRate: number;

  @ApiProperty()
  usageByDay: { date: string; count: number }[];
}
