import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum EscrowStatus {
  PENDING = 'pending',
  LOCKED = 'locked',
  RELEASED = 'released',
  REFUNDED = 'refunded',
  CANCELLED = 'cancelled',
  FROZEN = 'frozen',
  PARTIALLY_RELEASED = 'partially_released',
}

@Entity('escrow_transactions')
@Index(['orderId'])
@Index(['buyerPublicKey'])
@Index(['sellerPublicKey'])
@Index(['status'])
export class EscrowEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  orderId: string;

  @Column()
  buyerPublicKey: string;

  @Column()
  sellerPublicKey: string;

  @Column('decimal', { precision: 20, scale: 7 })
  amount: number;

  @Column({
    name: 'released_amount',
    type: 'decimal',
    precision: 20,
    scale: 7,
    default: 0,
  })
  releasedAmount: number;

  @Column({
    name: 'refunded_amount',
    type: 'decimal',
    precision: 20,
    scale: 7,
    default: 0,
  })
  refundedAmount: number;

  @Column()
  escrowAccountPublicKey: string;

  @Column({ nullable: true })
  lockTransactionHash: string | null;

  @Column({ nullable: true })
  releaseTransactionHash: string | null;

  @Column({ nullable: true })
  refundTransactionHash: string | null;

  @Column({ type: 'enum', enum: EscrowStatus, default: EscrowStatus.PENDING })
  status: EscrowStatus;

  @Column({ nullable: true })
  deliveryConfirmedAt: Date;

  @Column({ nullable: true })
  cancelledAt: Date;

  @Column({ nullable: true })
  errorMessage: string;

  /**
   * Dispute flag - set to true when a dispute is opened against this escrow.
   * When true, auto-release is blocked even if delivery was confirmed.
   */
  @Column({ default: false })
  disputeFlag: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
