import { IsUUID, IsPositive, IsInt, Min, Max, IsNotEmpty, IsString, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateEscrowDto {
  @IsUUID('4', { message: 'Invalid transaction ID format' })
  @IsNotEmpty()
  transactionId: string;

  @IsPositive({ message: 'Amount must be positive' })
  @Transform(({ value }) => parseFloat(value))
  amount: number;

  @IsInt()
  @Min(24, { message: 'Minimum timeout is 24 hours' })
  @Max(720, { message: 'Maximum timeout is 720 hours (30 days)' })
  @Transform(({ value }) => parseInt(value, 10))
  timeoutHours: number;

  @IsString()
  @IsNotEmpty()
  @Matches(/^G[0-9A-Z]{55}$/, { 
    message: 'Invalid Stellar public key format' 
  })
  buyerAddress: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^G[0-9A-Z]{55}$/, {
    message: 'Invalid Stellar public key format'
  })
  sellerAddress: string;

  @IsString()
  @IsNotEmpty()
  memo: string;
}
