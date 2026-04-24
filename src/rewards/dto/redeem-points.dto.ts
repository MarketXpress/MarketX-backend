import { IsInt, IsNotEmpty, IsOptional, Min } from 'class-validator';

export class RedeemPointsDto {
  @IsInt()
  @IsNotEmpty()
  @Min(1)
  points: number;

  @IsOptional()
  @IsNotEmpty()
  couponCode?: string;
}
