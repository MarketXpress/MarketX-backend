import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsNumber,
  IsDateString,
  IsEnum,
} from 'class-validator';
import {
  TransactionStatus,
  TransactionType,
} from '../entities/transaction.entity';

export class TransactionSearchDto {
  @ApiProperty({ description: 'Filter by user ID', required: false })
  @IsOptional()
  @IsNumber()
  userId?: number;

  @ApiProperty({
    description: 'Filter by transaction status',
    enum: TransactionStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(TransactionStatus)
  status?: TransactionStatus;

  @ApiProperty({
    description: 'Filter by transaction type',
    enum: TransactionType,
    required: false,
  })
  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @ApiProperty({ description: 'Minimum amount filter', required: false })
  @IsOptional()
  @IsNumber()
  minAmount?: number;

  @ApiProperty({ description: 'Maximum amount filter', required: false })
  @IsOptional()
  @IsNumber()
  maxAmount?: number;

  @ApiProperty({
    description: 'Filter by start date (ISO format)',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({
    description: 'Filter by end date (ISO format)',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({
    description: 'Search in transaction descriptions',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;
}

export class TransactionFilterDto {
  @ApiProperty({ description: 'Page number (default: 1)', required: false })
  @IsOptional()
  @IsNumber()
  page?: number;

  @ApiProperty({ description: 'Items per page (default: 10)', required: false })
  @IsOptional()
  @IsNumber()
  limit?: number;

  @ApiProperty({
    description: 'Filter by transaction status',
    enum: TransactionStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(TransactionStatus)
  status?: TransactionStatus;

  @ApiProperty({
    description: 'Filter by transaction type',
    enum: TransactionType,
    required: false,
  })
  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @ApiProperty({
    description: 'Filter by start date (ISO format)',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({
    description: 'Filter by end date (ISO format)',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({
    description: 'Search in transaction descriptions',
    required: false,
  })
  @IsOptional()
  @IsString()
  search?: string;
}
