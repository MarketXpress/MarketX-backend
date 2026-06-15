import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
import { SupportedCurrency } from '../../products/services/pricing.service';
import { OrderStatus } from '../entities/order.entity';

export class CreateOrderItemDto {
  @IsString()
  @IsNotEmpty()
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
  buyerId: string;

  @IsOptional()
  @IsString()
  shippingAddress?: string;

  @IsOptional()
  @IsEnum(SupportedCurrency)
  paymentCurrency?: SupportedCurrency;
}

export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus)
  status: OrderStatus;
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
}
