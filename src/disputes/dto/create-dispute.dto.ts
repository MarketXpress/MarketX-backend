import { IsString } from 'class-validator';

export class CreateDisputeDto {
  @IsString()
  transactionId: string;

  @IsString()
  complainantId: string;

  @IsString()
  respondentId: string;

  @IsString()
  reason: string;
} 
