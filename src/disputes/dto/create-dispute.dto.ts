import { IsString, IsOptional } from 'class-validator';

export class CreateDisputeDto {
  @IsString()
  transactionId: string;

  @IsString()
  complainantId: string;

  @IsString()
  respondentId: string;

  @IsString()
  reason: string;

  @IsOptional()
  @IsString()
  escrowId?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  imageUrls?: string;
}
