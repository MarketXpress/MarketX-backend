import { ApiProperty } from '@nestjs/swagger';
import { TransactionStatus, TransactionType } from '../entities/transaction.entity';

export class UserDto {
  @ApiProperty({ description: 'User ID' })
  id: number;

  @ApiProperty({ description: 'User email' })
  email: string;

  @ApiProperty({ description: 'User name' })
  name: string;
}

export class TransactionResponseDto {
  @ApiProperty({ description: 'Transaction ID' })
  id: string;

  @ApiProperty({ description: 'Transaction amount' })
  amount: number;

  @ApiProperty({ description: 'Transaction currency' })
  currency: string;

  @ApiProperty({ description: 'Transaction description', required: false })
  description?: string;

  @ApiProperty({ description: 'Transaction status', enum: TransactionStatus })
  status: TransactionStatus;

  @ApiProperty({ description: 'Transaction type', enum: TransactionType })
  type: TransactionType;

  @ApiProperty({ description: 'Sender information', type: UserDto })
  sender: UserDto;

  @ApiProperty({ description: 'Receiver information', type: UserDto })
  receiver: UserDto;

  @ApiProperty({ description: 'Transaction creation date' })
  createdAt: Date;

  @ApiProperty({ description: 'Transaction last update date' })
  updatedAt: Date;
} 