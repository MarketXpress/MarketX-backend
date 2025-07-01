import { IsString, IsOptional, IsNumber, IsArray } from 'class-validator';

export class CacheKeyDto {
  @IsString()
  key: string;

  @IsOptional()
  @IsNumber()
  ttl?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class InvalidateCacheDto {
  @IsOptional()
  @IsString()
  pattern?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keys?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
