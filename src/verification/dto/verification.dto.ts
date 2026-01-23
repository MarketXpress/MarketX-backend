import { IsEnum, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';
import { VerificationType } from '../enums/verification.enums';

export class StartVerificationDto {
  @IsNumber()
  userId: number;

  @IsEnum(VerificationType)
  verificationType: VerificationType;
}

export class UploadDocumentDto {
  @IsNumber()
  userId: number;

  @IsEnum(VerificationType)
  verificationType: VerificationType;
}
