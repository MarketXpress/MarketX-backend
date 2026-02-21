import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional, IsNumber } from 'class-validator';
import { VerificationStatus, VerificationLevel } from '../enums/verification.enums';

export class AdminReviewDto {
  @ApiProperty({ description: 'Verification ID' })
  @IsNumber()
  verificationId: number;

  @ApiProperty({ description: 'Review action', enum: VerificationStatus })
  @IsEnum([VerificationStatus.VERIFIED, VerificationStatus.REJECTED, VerificationStatus.REQUIRES_ACTION])
  action: VerificationStatus;

  @ApiProperty({ description: 'Admin review notes', required: false })
  @IsOptional()
  @IsString()
  adminNotes?: string;

  @ApiProperty({ description: 'Rejection reason (if rejected)', required: false })
  @IsOptional()
  @IsString()
  rejectionReason?: string;

  @ApiProperty({ description: 'Verification level to assign', enum: VerificationLevel, required: false })
  @IsOptional()
  @IsEnum(VerificationLevel)
  verificationLevel?: VerificationLevel;

  @ApiProperty({ description: 'Verification expiry in days (default: 365)', required: false })
  @IsOptional()
  @IsNumber()
  expiresInSeconds?: number;

  @ApiProperty({ description: 'Additional metadata', required: false })
  @IsOptional()
  metadata?: Record<string, any>;
}

export class BulkReviewDto {
  @ApiProperty({ description: 'Array of verification IDs to review' })
  @IsNumber()
  verificationIds: number[];

  @ApiProperty({ description: 'Bulk review action', enum: VerificationStatus })
  @IsEnum([VerificationStatus.VERIFIED, VerificationStatus.REJECTED])
  action: VerificationStatus;

  @ApiProperty({ description: 'Bulk admin notes', required: false })
  @IsOptional()
  @IsString()
  adminNotes?: string;

  @ApiProperty({ description: 'Bulk rejection reason', required: false })
  @IsOptional()
  @IsString()
  rejectionReason?: string;
}

export class VerificationQueryDto {
  @ApiProperty({ description: 'Filter by status', required: false })
  @IsOptional()
  @IsEnum(VerificationStatus)
  status?: VerificationStatus;

  @ApiProperty({ description: 'Filter by verification type', required: false })
  @IsOptional()
  @IsString()
  verificationType?: string;

  @ApiProperty({ description: 'Filter by user ID', required: false })
  @IsOptional()
  @IsNumber()
  userId?: number;

  @ApiProperty({ description: 'Page number', required: false })
  @IsOptional()
  @IsNumber()
  page?: number;

  @ApiProperty({ description: 'Items per page', required: false })
  @IsOptional()
  @IsNumber()
  limit?: number;

  @ApiProperty({ description: 'Sort by field', required: false })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiProperty({ description: 'Sort order', required: false })
  @IsOptional()
  @IsString()
  sortOrder?: 'ASC' | 'DESC';
}
