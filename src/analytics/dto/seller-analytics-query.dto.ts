import {
  IsString,
  IsOptional,
  IsDate,
  IsEnum,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum DateRange {
  TODAY = 'today',
  YESTERDAY = 'yesterday',
  LAST_7_DAYS = 'last_7_days',
  LAST_30_DAYS = 'last_30_days',
  THIS_MONTH = 'this_month',
  LAST_MONTH = 'last_month',
  THIS_YEAR = 'this_year',
  CUSTOM = 'custom',
}

export enum ExportFormat {
  JSON = 'json',
  CSV = 'csv',
}

export class SellerAnalyticsQueryDto {
  @ApiProperty({
    enum: DateRange,
    description: 'Predefined date range',
    default: DateRange.LAST_30_DAYS,
  })
  @IsEnum(DateRange)
  dateRange: DateRange = DateRange.LAST_30_DAYS;

  @ApiPropertyOptional({ description: 'Custom start date (for custom range)' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  startDate?: Date;

  @ApiPropertyOptional({ description: 'Custom end date (for custom range)' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  endDate?: Date;

  @ApiPropertyOptional({ description: 'Product ID to filter analytics' })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({ description: 'Category ID to filter analytics' })
  @IsOptional()
  @IsString()
  categoryId?: string;
}

export class ExportAnalyticsQueryDto extends SellerAnalyticsQueryDto {
  @ApiProperty({
    enum: ExportFormat,
    description: 'Export format',
    default: ExportFormat.JSON,
  })
  @IsEnum(ExportFormat)
  format: ExportFormat = ExportFormat.JSON;
}
