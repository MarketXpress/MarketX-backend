import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OrderItemForCouponDto {
  @ApiProperty({ description: 'Product ID' })
  @IsString()
  productId: string;

  @ApiProperty({ description: 'Category ID' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiProperty({ description: 'Quantity', minimum: 1 })
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiProperty({ description: 'Unit price' })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiProperty({ description: 'Subtotal (price * quantity)' })
  @IsNumber()
  @Min(0)
  subtotal: number;
}

export class ApplyCouponDto {
  @ApiProperty({ description: 'Coupon code', example: 'SUMMER2024' })
  @IsString()
  code: string;

  @ApiProperty({ description: 'User ID applying the coupon' })
  @IsString()
  userId: string;

  @ApiProperty({ description: 'Order items' })
  @IsArray()
  items: OrderItemForCouponDto[];

  @ApiPropertyOptional({ description: 'Current order subtotal' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  subtotal?: number;

  @ApiPropertyOptional({ description: 'Order currency', example: 'USD' })
  @IsOptional()
  @IsString()
  currency?: string;
}

export class ApplyCouponResponseDto {
  @ApiProperty({ description: 'Whether coupon was applied successfully' })
  valid: boolean;

  @ApiProperty({ description: 'Coupon ID' })
  couponId?: string;

  @ApiProperty({ description: 'Coupon code' })
  code?: string;

  @ApiProperty({ description: 'Discount amount applied' })
  discountAmount?: number;

  @ApiProperty({ description: 'New order total after discount' })
  newTotal?: number;

  @ApiProperty({ description: 'Error message if coupon is invalid' })
  message?: string;

  @ApiProperty({ description: 'Coupon restrictions that were applied' })
  appliedRestrictions?: string[];
}

export class RemoveCouponDto {
  @ApiProperty({ description: 'Order ID' })
  @IsString()
  orderId: string;
}
