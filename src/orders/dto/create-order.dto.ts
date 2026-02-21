import { Expose, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { SanitizeString } from '../../common/transformers/sanitize-string.transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SupportedCurrency } from '../../products/services/pricing.service';

export enum OrderStatus {
  PENDING = 'pending',
  PAID = 'paid',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
}

export class CreateOrderItemDto {
  @IsString()
  @IsNotEmpty()
  @SanitizeString()
  productId: string;

  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreateOrderDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];

  @IsString()
  @IsNotEmpty()
  @SanitizeString()
  buyerId: string;

  @IsOptional()
  @IsEnum(SupportedCurrency)
  paymentCurrency?: SupportedCurrency;
}

export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus)
  status: OrderStatus;
}

class OrderItemResponseDto {
  @ApiProperty()
  @Expose()
  productId: string;

  @ApiProperty()
  @Expose()
  productName: string;

  @ApiProperty()
  @Expose()
  quantity: number;

  @ApiProperty()
  @Expose()
  price: number;

  @ApiProperty()
  @Expose()
  subtotal: number;

  @ApiProperty({ enum: SupportedCurrency })
  @Expose()
  priceCurrency: SupportedCurrency;
}

export class OrderResponseDto {
  @ApiProperty()
  @Expose()
  id: string;

  @ApiProperty()
  @Expose()
  totalAmount: number;

  @ApiProperty({ enum: OrderStatus })
  @Expose()
  status: OrderStatus;

  @ApiPropertyOptional()
  @Expose()
  trackingNumber?: string;

  @ApiProperty({ type: [OrderItemResponseDto] })
  @Expose()
  @Type(() => OrderItemResponseDto)
  items: OrderItemResponseDto[];

  @ApiProperty()
  @Expose()
  buyerId: string;

  @ApiProperty({ enum: SupportedCurrency })
  @Expose()
  currency: SupportedCurrency;

  @ApiProperty()
  @Expose()
  createdAt: Date;

  @ApiProperty()
  @Expose()
  updatedAt: Date;

  @ApiPropertyOptional()
  @Expose()
  cancelledAt?: Date;

  @ApiPropertyOptional()
  @Expose()
  shippedAt?: Date;

  @ApiPropertyOptional()
  @Expose()
  deliveredAt?: Date;
}
