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

  @Column()
  escrowAccountPublicKey: string;

  @Column({ nullable: true })
  lockTransactionHash: string;

  @Column({ nullable: true })
  releaseTransactionHash: string;

  @Column({ nullable: true })
  refundTransactionHash: string;

  @Column({ type: 'enum', enum: EscrowStatus, default: EscrowStatus.PENDING })
  status: EscrowStatus;

  @Column({ nullable: true })
  deliveryConfirmedAt: Date;

  @Column({ nullable: true })
  cancelledAt: Date;

  @Column({ nullable: true })
  errorMessage: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
