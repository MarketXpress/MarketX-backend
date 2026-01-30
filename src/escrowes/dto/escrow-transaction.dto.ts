import { IsString, IsNumber, IsPositive, Min, Max } from 'class-validator';
import { EscrowStatus } from '../entities/escrow.entity';

export class CreateEscrowDto {
  @IsString()
  orderId: string;

  @IsString()
  buyerPublicKey: string;

  @IsString()
  sellerPublicKey: string;

  @IsNumber()
  @IsPositive()
  amount: number;
}

export class ReleaseEscrowDto {
  @IsString()
  escrowId: string;

  @IsString()
  deliveryProof: string;
}

export class RefundEscrowDto {
  @IsString()
  escrowId: string;

  @IsString()
  reason: string;
}

export class EscrowResponseDto {
  id: string;
  orderId: string;
  buyerPublicKey: string;
  sellerPublicKey: string;
  amount: number;
  escrowAccountPublicKey: string;
  status: EscrowStatus;
  lockTransactionHash: string | null;
  releaseTransactionHash: string | null;
  refundTransactionHash: string | null;
  createdAt: Date;
  updatedAt: Date;
}
