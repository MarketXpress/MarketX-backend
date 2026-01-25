import { IsString, IsOptional } from 'class-validator';

export class SubmitEvidenceDto {
  @IsString()
  disputeId: string;

  @IsString()
  submittedBy: string;

  @IsString()
  fileUrl: string;

  @IsOptional()
  @IsString()
  description?: string;
} 