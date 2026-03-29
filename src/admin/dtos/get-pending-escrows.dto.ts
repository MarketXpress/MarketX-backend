import { IsOptional, IsInt, Min, IsEnum, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { EscrowStatus } from '../../escrowes/entities/escrow.entity';

/**
 * DTO for paginated pending escrows query
 * Shows aging escrows for admin visibility
 */
export class GetPendingEscrowsDto {
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
  @IsEnum(EscrowStatus)
  status?: EscrowStatus;

  @IsOptional()
  @IsDateString()
  olderThan?: string;

  @IsOptional()
  @IsDateString()
  newerThan?: string;
}
