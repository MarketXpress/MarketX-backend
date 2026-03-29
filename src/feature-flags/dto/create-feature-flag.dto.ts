import { IsString, IsBoolean, IsOptional, IsObject, IsNumber, Min, Max } from 'class-validator';

export class CreateFeatureFlagDto {
    @IsString()
    key: string;

    @IsBoolean()
    @IsOptional()
    enabled?: boolean;

    @IsString()
    @IsOptional()
    description?: string;

    @IsObject()
    @IsOptional()
    environmentDefaults?: Record<string, boolean>;

    @IsNumber()
    @Min(0)
    @Max(100)
    @IsOptional()
    rolloutPercentage?: number;
}
