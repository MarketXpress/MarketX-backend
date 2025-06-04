import { IsOptional, IsString, IsInt, Min, IsEnum, IsDateString, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { AuditActionType, AuditStatus } from '../entities/audit-log.entity';

export class GetAuditLogsDto {
  @IsOptional()
  @IsEnum(AuditActionType)
  action?: AuditActionType;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsEnum(AuditStatus)
  status?: AuditStatus;

  @IsOptional()
  @IsString()
  resourceType?: string;

  @IsOptional()
  @IsString()
  resourceId?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  includeExpired?: boolean = false;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @IsOptional()
  @IsString()
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
} 