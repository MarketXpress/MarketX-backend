
import { IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiProperty({ 
    description: 'User full name', 
    example: 'John Doe',
    required: false 
  })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Name must be at least 2 characters long' })
  @MaxLength(50, { message: 'Name must not exceed 50 characters' })
  name?: string;

  @ApiProperty({ 
    description: 'User bio/description', 
    example: 'Software developer passionate about clean code',
    required: false 
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Bio must not exceed 500 characters' })
  bio?: string;

  @ApiProperty({ 
    description: 'URL to user profile image', 
    example: 'https://example.com/avatar.jpg',
    required: false 
  })
  @IsOptional()
  @IsUrl({}, { message: 'Avatar URL must be a valid URL' })
  avatarUrl?: string;
}