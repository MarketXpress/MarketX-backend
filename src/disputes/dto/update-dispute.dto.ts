import { IsString, IsEnum, IsOptional } from 'class-validator';
import { DisputeStatus } from '../dispute.entity';

export class UpdateDisputeDto {
  @IsString()
  disputeId: string;

  @IsOptional()
  @IsEnum(DisputeStatus)
  status?: DisputeStatus;

  @IsOptional()
  @IsString()
  resolutionNote?: string;
} 