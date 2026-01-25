import { Exclude, Expose } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

@Exclude()
export class PublicProfileDto {
  @Expose()
  @ApiProperty()
  id: string;

  @Expose()
  @ApiProperty()
  firstName: string;

  @Expose()
  @ApiProperty()
  lastName: string;

  @Expose()
  @ApiProperty()
  profileImageUrl: string;

  @Expose()
  @ApiProperty()
  bio: string;

  @Expose()
  @ApiProperty()
  sellerRating: number;

  @Expose()
  @ApiProperty()
  totalReviews: number;

  @Expose()
  @ApiProperty()
  totalSales: number;

  @Expose()
  @ApiProperty()
  isVerifiedSeller: boolean;

  @Expose()
  @ApiProperty()
  createdAt: Date;
}