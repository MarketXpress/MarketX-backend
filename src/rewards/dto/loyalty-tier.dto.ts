import { IsEnum, IsNotEmpty, IsOptional, IsString, IsNumber, IsBoolean, Min, Max, ValidateNested, IsObject } from 'class-validator';
import { Type } from 'class-transformer';
import { LoyaltyTierName } from '../entities/loyalty-tier.entity';

export class TierBenefitDto {
  @IsNumber()
  @Min(1)
  pointsMultiplier: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  discountPercentage: number;

  @IsNumber()
  @Min(0)
  freeShippingThreshold: number;

  @IsString()
  @IsOptional()
  exclusiveAccess?: string[];

  @IsNumber()
  @Min(0)
  birthdayBonus: number;

  @IsNumber()
  @Min(0)
  anniversaryBonus: number;
}

export class CreateLoyaltyTierDto {
  @IsEnum(LoyaltyTierName)
  tierName: LoyaltyTierName;

  @IsString()
  @IsNotEmpty()
  displayName: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @Min(0)
  minPoints: number;

  @IsNumber()
  @IsOptional()
  maxPoints?: number;

  @ValidateNested()
  @Type(() => TierBenefitDto)
  benefits: TierBenefitDto;

  @IsString()
  @IsOptional()
  color?: string;

  @IsString()
  @IsOptional()
  icon?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsNumber()
  @Min(0)
  @IsOptional()
  sortOrder?: number;
}

export class UpdateLoyaltyTierDto {
  @IsString()
  @IsOptional()
  displayName?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsOptional()
  minPoints?: number;

  @IsNumber()
  @IsOptional()
  maxPoints?: number;

  @ValidateNested()
  @Type(() => TierBenefitDto)
  @IsOptional()
  benefits?: TierBenefitDto;

  @IsString()
  @IsOptional()
  color?: string;

  @IsString()
  @IsOptional()
  icon?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsNumber()
  @Min(0)
  @IsOptional()
  sortOrder?: number;
}

export class UserLoyaltySummaryDto {
  @IsString()
  currentTier: string;

  @IsString()
  currentTierDisplayName: string;

  @IsNumber()
  lifetimePoints: number;

  @IsNumber()
  currentYearPoints: number;

  @IsObject()
  @IsOptional()
  tierProgress?: {
    pointsToNextTier: number;
    nextTierName: string;
    progressPercentage: number;
  };

  @IsObject()
  @IsOptional()
  currentBenefits?: {
    pointsMultiplier: number;
    discountPercentage: number;
    freeShippingThreshold: number;
    exclusiveAccess: string[];
    birthdayBonus: number;
    anniversaryBonus: number;
  };

  @IsNumber()
  @IsOptional()
  monthsAtCurrentTier: number;
}
