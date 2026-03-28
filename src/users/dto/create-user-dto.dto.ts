import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ example: 'jane.doe@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'StrongPassword123', required: false })
  @IsOptional()
  @ValidateIf((o: CreateUserDto) => o.password !== null)
  @IsString()
  @MinLength(6)
  password?: string | null;

  @ApiProperty({ example: 'Jane Doe' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: 'Software developer with 5 years experience',
    required: false,
  })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiProperty({ example: 'https://example.com/avatar.jpg', required: false })
  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @ApiProperty({
    example: 'en',
    enum: ['en', 'es', 'fr'],
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsIn(['en', 'es', 'fr'])
  language?: string;

  @ApiProperty({ example: 'google', required: false })
  @IsOptional()
  @IsString()
  oauthProvider?: string | null;

  @ApiProperty({ example: 'google-uid-123', required: false })
  @IsOptional()
  @IsString()
  oauthProviderId?: string | null;
}
