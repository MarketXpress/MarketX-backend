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
  FUNDED = 'funded',
  IN_TRANSIT = 'in_transit',
  RELEASED = 'released',
  DISPUTED = 'disputed',
  REFUNDED = 'refunded',
}

@Entity('escrows')
export class Escrow {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'uuid', nullable: true })
  userId?: string | null;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  orderId?: string | null;

  @Column({ type: 'varchar', length: 66, nullable: true })
  @Index()
  transactionHash?: string | null;

  @Column({
    type: 'enum',
    enum: EscrowStatus,
    default: EscrowStatus.PENDING,
  })
  status: EscrowStatus;

  @Column({ type: 'varchar', length: 255, nullable: true })
  buyerPublicKey?: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  sellerPublicKey?: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  buyerSecretKey?: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
