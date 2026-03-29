import { IsString, IsOptional, IsNumber, Min, IsEnum } from 'class-validator';

export enum DisputeResolutionType {
  FULL_TO_BUYER = 'FULL_TO_BUYER',
  FULL_TO_SELLER = 'FULL_TO_SELLER',
  SPLIT_50_50 = 'SPLIT_50_50',
  CUSTOM_SPLIT = 'CUSTOM_SPLIT',
}

export class ResolveDisputeDto {
  @IsString()
  adminDecision: string;

  @IsOptional()
  @IsEnum(DisputeResolutionType)
  resolutionType?: DisputeResolutionType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  refundAmount?: number; // Amount to refund to buyer (for custom split or full to buyer)
}
