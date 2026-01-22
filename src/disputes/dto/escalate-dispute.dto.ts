import { IsString } from 'class-validator';

export class EscalateDisputeDto {
  @IsString()
  disputeId: string;

  @IsString()
  reason: string;
} 