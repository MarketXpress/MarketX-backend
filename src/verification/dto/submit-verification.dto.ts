import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEmail, IsOptional, IsDateString, IsEnum, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { VerificationType, DocumentType } from '../enums/verification.enums';

export class PersonalInfoDto {
  @ApiProperty({ description: 'First name' })
  @IsString()
  firstName: string;

  @ApiProperty({ description: 'Last name' })
  @IsString()
  lastName: string;

  @ApiProperty({ description: 'Date of birth (YYYY-MM-DD)' })
  @IsDateString()
  dateOfBirth: string;

  @ApiProperty({ description: 'Street address' })
  @IsString()
  address: string;

  @ApiProperty({ description: 'City' })
  @IsString()
  city: string;

  @ApiProperty({ description: 'Country' })
  @IsString()
  country: string;

  @ApiProperty({ description: 'Postal code' })
  @IsString()
  postalCode: string;
}

export class BusinessInfoDto {
  @ApiProperty({ description: 'Business name' })
  @IsString()
  businessName: string;

  @ApiProperty({ description: 'Business type' })
  @IsString()
  businessType: string;

  @ApiProperty({ description: 'Business registration number' })
  @IsString()
  registrationNumber: string;

  @ApiProperty({ description: 'Tax ID' })
  @IsString()
  taxId: string;

  @ApiProperty({ description: 'Business address' })
  @IsString()
  businessAddress: string;

  @ApiProperty({ description: 'Business website', required: false })
  @IsOptional()
  @IsString()
  website?: string;

  @ApiProperty({ description: 'Business description', required: false })
  @IsOptional()
  @IsString()
  description?: string;
}

export class DocumentUploadDto {
  @ApiProperty({ description: 'Document type', enum: DocumentType })
  @IsEnum(DocumentType)
  documentType: DocumentType;

  @ApiProperty({ description: 'Document file URL or base64' })
  @IsString()
  documentUrl: string;

  @ApiProperty({ description: 'Document filename' })
  @IsString()
  filename: string;
}

export class SubmitVerificationDto {
  @ApiProperty({ description: 'Verification type', enum: VerificationType })
  @IsEnum(VerificationType)
  verificationType: VerificationType;

  @ApiProperty({ description: 'Personal information', type: PersonalInfoDto })
  @ValidateNested()
  @Type(() => PersonalInfoDto)
  personalInfo: PersonalInfoDto;

  @ApiProperty({ description: 'Business information (for seller verification)', required: false, type: BusinessInfoDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => BusinessInfoDto)
  businessInfo?: BusinessInfoDto;

  @ApiProperty({ description: 'Documents to upload', type: [DocumentUploadDto] })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => DocumentUploadDto)
  documents?: DocumentUploadDto[];
}

export class UpdateVerificationStepDto {
  @ApiProperty({ description: 'Current verification step' })
  @IsString()
  currentStep: string;

  @ApiProperty({ description: 'Additional data for current step' })
  @IsOptional()
  stepData?: Record<string, any>;
}
