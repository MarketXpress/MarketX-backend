import {
  IsOptional,
  IsEnum,
  IsDate,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum AnalyticsGranularity {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
}

export enum AnalyticsExportFormat {
  CSV = 'csv',
  JSON = 'json',
}

export class AnalyticsQueryDto {
  @ApiPropertyOptional({ description: 'Start date (ISO format)' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  startDate?: Date;

  @ApiPropertyOptional({ description: 'End date (ISO format)' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  endDate?: Date;

  @ApiPropertyOptional({
    enum: AnalyticsGranularity,
    description: 'Time grouping granularity',
    default: AnalyticsGranularity.DAILY,
  })
  @IsOptional()
  @IsEnum(AnalyticsGranularity)
  granularity?: AnalyticsGranularity = AnalyticsGranularity.DAILY;

  @ApiPropertyOptional({
    enum: AnalyticsExportFormat,
    description: 'Export format',
  })
  @IsOptional()
  @IsEnum(AnalyticsExportFormat)
  export?: AnalyticsExportFormat;

  @ApiPropertyOptional({ description: 'Limit results (e.g., top products)', default: 10 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  limit?: number = 10;
}
