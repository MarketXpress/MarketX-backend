import { IsUUID, IsNotEmpty, IsPositive, IsOptional, IsEnum, IsString, Max, Min, IsBoolean } from 'class-validator';
import { EscrowStatus } from '../escrow.entity';

export class ConfirmReceiptDto {
  @IsUUID('4')
  @IsNotEmpty()
  escrowId: string;

  @IsString()
  @IsNotEmpty()
  buyerSignature: string;

  @IsBoolean()
  @IsNotEmpty()
  isConfirmed: boolean;
}

export class InitiateDisputeDto {
  @IsUUID('4')
  @IsNotEmpty()
  escrowId: string;

  @IsString()
  @IsNotEmpty()
  @Max(500)
  reason: string;

  @IsString()
  @IsNotEmpty()
  initiatorSignature: string; // Either buyer or seller
}

export class ResolveDisputeDto {
  @IsUUID('4')
  @IsNotEmpty()
  escrowId: string;

  @IsEnum(['release', 'refund'], {
    message: 'Resolution must be either "release" or "refund"'
  })
  resolution: string;

  @IsString()
  @IsNotEmpty()
  adminSignature: string;
}

export class ReleasePartialDto {
  @IsUUID('4')
  @IsNotEmpty()
  escrowId: string;

  @IsPositive()
  @Max(1000000) // Set your max amount
  amount: number;

  @IsString()
  @IsNotEmpty()
  recipientAddress: string;

  @IsString()
  @IsNotEmpty()
  releaseSignature: string; // Either party based on agreement
}

export class UpdateEscrowStatusDto {
  @IsUUID('4')
  @IsNotEmpty()
  escrowId: string;

  @IsEnum(EscrowStatus)
  status: EscrowStatus;

  @IsString()
  @IsOptional()
  @Max(500)
  memo?: string;
}
