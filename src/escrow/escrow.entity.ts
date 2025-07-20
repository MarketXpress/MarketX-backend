import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, ManyToOne } from 'typeorm';
import { Transaction } from '../transactions/entities/transaction.entity';
import { IsUUID, IsPositive, IsEnum, IsDate, IsOptional, ValidateIf } from 'class-validator';

export enum EscrowStatus {
  PENDING = 'PENDING',
  LOCKED = 'LOCKED',
  RELEASED = 'RELEASED',
  DISPUTED = 'DISPUTED',
  EXPIRED = 'EXPIRED',
  REFUNDED = 'REFUNDED'
}

@Entity()
@Index(['transactionId', 'status']) // Composite index for common query patterns
@Index(['timeoutAt']) // Index for timeout job processing
@Index(['status']) // Index for status-based queries
export class Escrow {
  @PrimaryGeneratedColumn('uuid')
  @IsUUID()
  id: string;

  @ManyToOne(() => Transaction, { nullable: false })
  transaction: Transaction;

  @Column({ type: 'uuid' })
  @IsUUID()
  transactionId: string;

  @Column({
    type: 'decimal',
    precision: 20,
    scale: 7, // Sufficient for most cryptocurrencies
    unsigned: true
  })
  @IsPositive()
  amount: number;

  @Column({
    type: 'enum',
    enum: EscrowStatus,
    default: EscrowStatus.PENDING
  })
  @IsEnum(EscrowStatus)
  status: EscrowStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  @IsDate()
  createdAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  @IsOptional()
  @IsDate()
  @ValidateIf(o => o.status === EscrowStatus.RELEASED || o.status === EscrowStatus.REFUNDED)
  releasedAt?: Date;

  @Column({ type: 'timestamptz' })
  @IsDate()
  timeoutAt: Date;

  @Column({ type: 'text', nullable: true })
  @IsOptional()
  disputeReason?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  @IsOptional()
  releasedTo?: string; // Stellar address funds were released to

  // Version column for optimistic locking
  @Column({ type: 'integer', default: 1 })
  version: number;

  // Helper methods for state transitions
  canTransitionTo(newStatus: EscrowStatus): boolean {
    const validTransitions: Record<EscrowStatus, EscrowStatus[]> = {
      [EscrowStatus.PENDING]: [EscrowStatus.LOCKED],
      [EscrowStatus.LOCKED]: [EscrowStatus.RELEASED, EscrowStatus.DISPUTED, EscrowStatus.EXPIRED],
      [EscrowStatus.DISPUTED]: [EscrowStatus.RELEASED, EscrowStatus.REFUNDED, EscrowStatus.EXPIRED],
      [EscrowStatus.RELEASED]: [],
      [EscrowStatus.EXPIRED]: [],
      [EscrowStatus.REFUNDED]: []
    };

    return validTransitions[this.status].includes(newStatus);
  }
}
