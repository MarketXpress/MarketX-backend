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
  Max,
  Min,
  ValidateNested,
  IsNumber,
} from 'class-validator';
import { SanitizeString } from '../../common/transformers/sanitize-string.transformer';
import { SupportedCurrency } from '../../products/services/pricing.service';
import {
  MilestoneType,
  MilestoneTrigger,
} from '../../milestones/enums/milestone.enums';

export enum OrderStatus {
  PENDING = 'pending',
  PAID = 'paid',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  MANUAL_REVIEW = 'manual_review',
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

export class CreateOrderMilestoneDto {
  @IsString()
  @IsNotEmpty()
  @SanitizeString()
  title: string;

  @IsString()
  @IsNotEmpty()
  @SanitizeString()
  description: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  percentage: number;

  @IsOptional()
  @IsEnum(MilestoneType)
  type?: MilestoneType;

  @IsOptional()
  @IsEnum(MilestoneTrigger)
  trigger?: MilestoneTrigger;

  @IsOptional()
  autoRelease?: boolean;

  @IsOptional()
  @IsArray()
  releaseConditions?: string[];

  @IsOptional()
  @IsArray()
  requiredDocuments?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
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

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderMilestoneDto)
  milestones?: CreateOrderMilestoneDto[];

  @IsOptional()
  @IsString()
  @SanitizeString()
  escrowType?: string; // 'standard' or 'milestone'
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
