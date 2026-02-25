import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { RefundType, ReturnReason } from '../entities/refund.entity';

export class RequestRefundDto {
  @IsEnum(RefundType)
  type: RefundType;

  @IsEnum(ReturnReason)
  reason: ReturnReason;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.0000001)
  requestedAmount?: number; // Required only for PARTIAL refunds
}
