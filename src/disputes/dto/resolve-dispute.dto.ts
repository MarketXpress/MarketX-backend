import { IsString, IsOptional, IsNumber } from 'class-validator';

export class ResolveDisputeDto {
  @IsString()
  adminDecision: string;

  @IsOptional()
  @IsNumber()
  refundAmount?: number;
}