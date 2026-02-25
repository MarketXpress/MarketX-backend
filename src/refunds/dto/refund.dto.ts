import {
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  IsUUID,
  IsNumber,
  Min,
  Max,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReturnReason, RefundType } from '../entities/return-request.entity';

/**
 * DTO for creating a return request
 */
export class CreateReturnRequestDto {
  @ApiProperty({ description: 'Order ID' })
  @IsUUID()
  orderId: string;

  @ApiProperty({ description: 'Buyer ID' })
  @IsUUID()
  buyerId: string;

  @ApiProperty({ description: 'Seller ID' })
  @IsUUID()
  sellerId: string;

  @ApiProperty({ enum: ReturnReason, description: 'Reason for return' })
  @IsEnum(ReturnReason)
  reason: ReturnReason;

  @ApiPropertyOptional({ description: 'Description of the reason' })
  @IsOptional()
  @IsString()
  reasonDescription?: string;

  @ApiPropertyOptional({ enum: RefundType, description: 'Full or partial refund' })
  @IsOptional()
  @IsEnum(RefundType)
  refundType?: RefundType = RefundType.FULL;

  @ApiPropertyOptional({ description: 'For partial refunds, specify items' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReturnItemDto)
  items?: ReturnItemDto[];

  @ApiPropertyOptional({ description: 'Return window in days' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(90)
  returnWindowDays?: number = 30;
}

export class ReturnItemDto {
  @ApiProperty({ description: 'Listing/Product ID' })
  @IsUUID()
  listingId: string;

  @ApiProperty({ description: 'Quantity to return' })
  @IsInt()
  @Min(1)
  quantity: number;
}

/**
 * DTO for approving/rejecting a return request
 */
export class ReviewReturnRequestDto {
  @ApiProperty({ enum: ['approved', 'rejected'] })
  @IsEnum(['approved', 'rejected'])
  action: 'approved' | 'rejected';

  @ApiPropertyOptional({ description: 'Notes from the reviewer' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'For partial refunds, the approved amount' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  approvedAmount?: number;
}

/**
 * DTO for processing a refund (after return is received)
 */
export class ProcessRefundDto {
  @ApiProperty({ description: 'Return request ID' })
  @IsUUID()
  returnRequestId: string;

  @ApiProperty({ description: 'Admin/Processor ID' })
  @IsUUID()
  processedBy: string;

  @ApiPropertyOptional({ description: 'Stellar address for refund' })
  @IsOptional()
  @IsString()
  stellarRefundAddress?: string;

  @ApiPropertyOptional({ description: 'Tracking number for return shipment' })
  @IsOptional()
  @IsString()
  trackingNumber?: string;
}

/**
 * DTO for querying return requests
 */
export class QueryReturnRequestsDto {
  @ApiPropertyOptional({ description: 'Filter by buyer ID' })
  @IsOptional()
  @IsUUID()
  buyerId?: string;

  @ApiPropertyOptional({ description: 'Filter by seller ID' })
  @IsOptional()
  @IsUUID()
  sellerId?: string;

  @ApiPropertyOptional({ description: 'Filter by status' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Filter by order ID' })
  @IsOptional()
  @IsUUID()
  orderId?: string;

  @ApiPropertyOptional({ description: 'Limit results' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Offset' })
  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number = 0;
}
