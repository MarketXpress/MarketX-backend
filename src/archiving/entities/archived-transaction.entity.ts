import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import {
  TransactionStatus,
  TransactionType,
} from '../../transactions/entities/transaction.entity';

@Entity('archived_transactions')
@Index(['senderId', 'createdAt'])
@Index(['receiverId', 'createdAt'])
@Index(['status', 'createdAt'])
export class ArchivedTransaction {
  @ApiProperty({ description: 'Unique transaction identifier' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Transaction amount' })
  @Column('decimal', { precision: 10, scale: 2 })
  amount: number;

  @ApiProperty({ description: 'Transaction currency', default: 'USD' })
  @Column({ length: 3, default: 'USD' })
  currency: string;

  @ApiProperty({ description: 'Transaction description' })
  @Column('text', { nullable: true })
  description: string;

  @ApiProperty({ description: 'Transaction status', enum: TransactionStatus })
  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.PENDING,
  })
  status: TransactionStatus;

  @ApiProperty({ description: 'Transaction type', enum: TransactionType })
  @Column({
    type: 'enum',
    enum: TransactionType,
    default: TransactionType.TRANSFER,
  })
  type: TransactionType;

  @ApiProperty({ description: 'Sender user ID' })
  @Column({ name: 'sender_id' })
  @Index()
  senderId: number;

  @ApiProperty({ description: 'Receiver user ID' })
  @Column({ name: 'receiver_id' })
  @Index()
  receiverId: number;

  @ApiProperty({
    description: 'Related listing ID if transaction is for a purchase',
  })
  @Column({ name: 'listing_id', nullable: true })
  listingId: string;

  @ApiProperty({ description: 'Transaction metadata' })
  @Column('json', { nullable: true })
  metadata: Record<string, any>;

  @ApiProperty({ description: 'External transaction reference' })
  @Column({ name: 'external_reference', nullable: true })
  externalReference: string;

  @ApiProperty({ description: 'Stellar blockchain transaction hash' })
  @Column({ name: 'stellar_hash', nullable: true, length: 64 })
  stellarHash: string;

  @ApiProperty({ description: 'Transaction creation timestamp' })
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty({ description: 'Transaction last update timestamp' })
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
