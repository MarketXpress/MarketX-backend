import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsDateString,
  IsObject,
  ValidateNested,
  Min,
} from 'class-validator';
import { SanitizeString } from '../../common/transformers/sanitize-string.transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export enum ShippingCarrier {
  UPS = 'ups',
  FEDEX = 'fedex',
  DHL = 'dhl',
  USPS = 'usps',
  LOCAL = 'local',
}

export enum ShipmentStatus {
  LABEL_CREATED = 'label_created',
  PICKED_UP = 'picked_up',
  IN_TRANSIT = 'in_transit',
  OUT_FOR_DELIVERY = 'out_for_delivery',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  RETURNED = 'returned',
}

export class ShippingAddressDto {
  @IsString()
  @IsNotEmpty()
  @SanitizeString()
  street: string;

  @IsString()
  @IsNotEmpty()
  @SanitizeString()
  city: string;

  @IsString()
  @IsNotEmpty()
  @SanitizeString()
  state: string;

  @IsString()
  @IsNotEmpty()
  @SanitizeString()
  postalCode: string;

  @IsString()
  @IsNotEmpty()
  @SanitizeString()
  country: string;
}

export class PackageDimensionsDto {
  @IsNumber()
  @Min(0)
  length: number;

  @IsNumber()
  @Min(0)
  width: number;

  @IsNumber()
  @Min(0)
  height: number;

  @IsString()
  @IsOptional()
  unit?: string; // cm or in, defaults to cm
}

export class CreateShipmentDto {
  @IsString()
  @IsNotEmpty()
  @SanitizeString()
  @ApiProperty({ description: 'Order ID to create shipment for' })
  orderId: string;

  @IsEnum(ShippingCarrier)
  @ApiProperty({ enum: ShippingCarrier, description: 'Shipping carrier' })
  carrier: ShippingCarrier;

  @IsString()
  @IsNotEmpty()
  @SanitizeString()
  @ApiProperty({ description: 'Carrier tracking number' })
  trackingNumber: string;

  @IsObject()
  @ValidateNested()
  @Type(() => ShippingAddressDto)
  @ApiProperty({ description: 'Destination shipping address' })
  shippingAddress: ShippingAddressDto;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @ApiPropertyOptional({ description: 'Package weight in kg' })
  weight?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => PackageDimensionsDto)
  @ApiPropertyOptional({ description: 'Package dimensions' })
  dimensions?: PackageDimensionsDto;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @ApiPropertyOptional({ description: 'Shipping cost' })
  shippingCost?: number;

  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({ description: 'Estimated delivery date (ISO 8601)' })
  estimatedDeliveryDate?: string;

  @IsOptional()
  @IsString()
  @SanitizeString()
  @ApiPropertyOptional({ description: 'URL to the shipping label' })
  labelUrl?: string;

  @IsOptional()
  @IsString()
  @SanitizeString()
  @ApiPropertyOptional({ description: 'Additional notes' })
  notes?: string;
}

export class UpdateShipmentStatusDto {
  @IsEnum(ShipmentStatus)
  @ApiProperty({ enum: ShipmentStatus, description: 'New shipment status' })
  status: ShipmentStatus;

  @IsOptional()
  @IsString()
  @SanitizeString()
  @ApiPropertyOptional({ description: 'Notes about this status update' })
  notes?: string;
}

export class ShipmentResponseDto {
  @ApiProperty()
  @Expose()
  id: string;

  @ApiProperty()
  @Expose()
  orderId: string;

  @ApiProperty({ enum: ShippingCarrier })
  @Expose()
  carrier: ShippingCarrier;

  @ApiProperty()
  @Expose()
  trackingNumber: string;

  @ApiProperty({ enum: ShipmentStatus })
  @Expose()
  status: ShipmentStatus;

  @ApiProperty()
  @Expose()
  shippingAddress: Record<string, string>;

  @ApiPropertyOptional()
  @Expose()
  weight?: number;

  @ApiPropertyOptional()
  @Expose()
  dimensions?: Record<string, any>;

  @ApiPropertyOptional()
  @Expose()
  shippingCost?: number;

  @ApiPropertyOptional()
  @Expose()
  estimatedDeliveryDate?: Date;

  @ApiPropertyOptional()
  @Expose()
  actualDeliveryDate?: Date;

  @ApiPropertyOptional()
  @Expose()
  labelUrl?: string;

  @ApiPropertyOptional()
  @Expose()
  notes?: string;

  @ApiProperty()
  @Expose()
  createdAt: Date;

  @ApiProperty()
  @Expose()
  updatedAt: Date;
}

export class CarrierInfoDto {
  @ApiProperty({ enum: ShippingCarrier })
  @Expose()
  carrier: ShippingCarrier;

  @ApiProperty()
  @Expose()
  name: string;

  @ApiProperty()
  @Expose()
  trackingUrlTemplate: string;

  @ApiProperty()
  @Expose()
  estimatedDeliveryDays: { min: number; max: number };
}
