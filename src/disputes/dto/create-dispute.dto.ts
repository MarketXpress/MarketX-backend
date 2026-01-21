import { IsString, IsOptional } from 'class-validator';

export class CreateDisputeDto {
  @IsString()
  description: string;

  @IsOptional()
  @IsString()
  evidence?: string;
}