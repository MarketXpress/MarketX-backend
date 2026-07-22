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
  RELEASED = 'released',
  REFUNDED = 'refunded',
  FAILED = 'failed',
}

@Entity('escrows')
export class Escrow {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'decimal', precision: 12, scale: 7 })
  amount: number;

  /**
   * The buyer who initiated the escrow.
   * Column name kept as 'userId' for backwards-compatibility with existing rows.
   */
  @Column({ type: 'uuid', name: 'userId' })
  @Index()
  buyerId: string;

  /** The seller who will receive funds on release. */
  @Column({ type: 'uuid', name: 'seller_id' })
  @Index()
  sellerId: string;

  @Column({
    type: 'enum',
    enum: EscrowStatus,
    default: EscrowStatus.PENDING,
  })
  @Index()
  status: EscrowStatus;

  /** Stellar public key of the generated escrow keypair. */
  @Column({ type: 'varchar', length: 56, nullable: true })
  escrowPublicKey?: string | null;

  /**
   * Envelope-encrypted Stellar secret key of the generated escrow keypair
   * (JSON blob from EncryptionService: ciphertext + iv + auth tag, not a
   * raw Stellar seed). `select: false` so ordinary queries never pull it
   * back — callers must opt in explicitly, and only to sign a transaction.
   */
  @Column({ type: 'text', nullable: true, select: false })
  escrowSecretKey?: string | null;

  /** Hash of the funding transaction (createEscrow) or release transaction (releaseEscrow). */
  @Column({ type: 'varchar', length: 66, nullable: true })
  @Index()
  transactionHash?: string | null;

  /** @deprecated Use `status` instead. Kept for backwards compatibility. */
  @Column({ default: false })
  released: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
