import { IsString, IsOptional, IsInt, Min, Max, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TrackViewDto {
  @ApiProperty({ description: 'User ID' })
  @IsUUID()
  userId: string;

  @ApiProperty({ description: 'Listing/Product ID' })
  @IsUUID()
  listingId: string;

  @ApiPropertyOptional({ description: 'Time spent viewing in seconds' })
  @IsOptional()
  @IsInt()
  @Min(0)
  viewDuration?: number;
}

export class AddToCartDto {
  @ApiProperty({ description: 'User ID' })
  @IsUUID()
  userId: string;

  @ApiProperty({ description: 'Listing/Product ID' })
  @IsUUID()
  listingId: string;
}

export class GetRecommendationsDto {
  @ApiProperty({ description: 'User ID' })
  @IsUUID()
  userId: string;

  @ApiPropertyOptional({ description: 'Maximum number of recommendations' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10;
}

export class GetSimilarProductsDto {
  @ApiProperty({ description: 'Listing/Product ID' })
  @IsUUID()
  listingId: string;

  @ApiPropertyOptional({ description: 'Maximum number of similar products' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number = 5;
}

export class GetFrequentlyBoughtTogetherDto {
  @ApiProperty({ description: 'Listing/Product ID' })
  @IsUUID()
  listingId: string;

  @ApiPropertyOptional({ description: 'Maximum number of items' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  limit?: number = 5;
}
