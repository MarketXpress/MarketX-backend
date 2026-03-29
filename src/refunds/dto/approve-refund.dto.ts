import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class ApproveRefundDto {
  @IsNumber()
  @Min(0.0000001)
  approvedAmount: number;

  @IsOptional()
  @IsString()
  adminNotes?: string;
}
