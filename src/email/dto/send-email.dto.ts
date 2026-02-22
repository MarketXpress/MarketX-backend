import { IsEmail, IsString, IsOptional, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SendEmailDto {
  @ApiProperty({ description: 'Recipient email address' })
  @IsEmail()
  to: string;

  @ApiProperty({ description: 'Email subject' })
  @IsString()
  subject: string;

  @ApiProperty({ description: 'Template name' })
  @IsString()
  template: string;

  @ApiPropertyOptional({ description: 'Context variables for the template' })
  @IsOptional()
  @IsObject()
  context?: Record<string, any>;
}
