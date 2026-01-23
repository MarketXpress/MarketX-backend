import { ApiProperty } from '@nestjs/swagger';
import { Transaction } from '../entities/transaction.entity';

export class StellarVerificationResponseDto {
  @ApiProperty({ description: 'Stellar transaction details' })
  stellarTransaction: any;

  @ApiProperty({ description: 'Local transaction record', required: false })
  localTransaction?: Transaction;

  @ApiProperty({ description: 'Verification status' })
  isVerified: boolean;
}

export class StellarTransactionDetailsDto {
  @ApiProperty({ description: 'Transaction hash' })
  hash: string;

  @ApiProperty({ description: 'Transaction successful status' })
  successful: boolean;

  @ApiProperty({ description: 'Transaction ledger' })
  ledger: number;

  @ApiProperty({ description: 'Transaction created at timestamp' })
  created_at: string;

  @ApiProperty({ description: 'Transaction source account' })
  source_account: string;

  @ApiProperty({ description: 'Transaction memo' })
  memo?: string;

  @ApiProperty({ description: 'Transaction operations' })
  operations: any[];
}
