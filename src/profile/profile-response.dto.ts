import { Exclude, Expose } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { ProfileVisibility } from './user.entity';

@Exclude()
export class ProfileResponseDto {
  @Expose()
  @ApiProperty()
  id: string;

  @Expose()
  @ApiProperty()
  email: string;

  @Expose()
  @ApiProperty()
  firstName: string;

  @Expose()
  @ApiProperty()
  lastName: string;

  @Expose()
  @ApiProperty()
  phoneNumber: string;

  @Expose()
  @ApiProperty()
  profileImageUrl: string;

  @Expose()
  @ApiProperty()
  bio: string;

  @Expose()
  @ApiProperty()
  stellarWalletAddress: string;

  @Expose()
  @ApiProperty({ enum: ProfileVisibility })
  profileVisibility: ProfileVisibility;

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

  @Expose()
  @ApiProperty()
  updatedAt: Date;
}