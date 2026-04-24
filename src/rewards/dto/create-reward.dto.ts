import { IsInt, IsNotEmpty, IsOptional, IsEnum, IsUUID } from 'class-validator';
import { PointsTransactionType } from '../entities/reward-points.entity';

export class CreateRewardDto {
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @IsInt()
  @IsNotEmpty()
  points: number;

  @IsEnum(PointsTransactionType)
  @IsOptional()
  transactionType?: PointsTransactionType;

  @IsOptional()
  description?: string;

  @IsOptional()
  @IsUUID()
  referenceId?: string;

  @IsOptional()
  referenceType?: string;
}
