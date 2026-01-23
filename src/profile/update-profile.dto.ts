import {
  IsString,
  IsEmail,
  IsOptional,
  IsUrl,
  IsEnum,
  MinLength,
  MaxLength,
  Matches,
  IsPhoneNumber,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ProfileVisibility } from '../entities/user.entity';

export class UpdateProfileDto {
  @ApiProperty({ required: false, example: 'John' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  firstName?: string;

  @ApiProperty({ required: false, example: 'Doe' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  lastName?: string;

  @ApiProperty({ required: false, example: '+1234567890' })
  @IsOptional()
  @IsPhoneNumber()
  phoneNumber?: string;

  @ApiProperty({
    required: false,
    example: 'https://example.com/profile.jpg',
  })
  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  profileImageUrl?: string;

  @ApiProperty({
    required: false,
    example: 'Passionate seller of quality products',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @ApiProperty({
    required: false,
    example: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    description: 'Stellar wallet address (56 characters starting with G)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^G[A-Z2-7]{55}$/, {
    message: 'Invalid Stellar wallet address format',
  })
  stellarWalletAddress?: string;

  @ApiProperty({
    required: false,
    enum: ProfileVisibility,
    example: ProfileVisibility.PUBLIC,
  })
  @IsOptional()
  @IsEnum(ProfileVisibility)
  profileVisibility?: ProfileVisibility;
}