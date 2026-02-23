import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Users } from '../../users/users.entity';

/**
 * Return request status enum
 */
export enum ReturnStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  PROCESSING = 'processing',
  COMPLETED = 'cancelled', // When refund is completed
}

/**
 * Refund type enum
 */
export enum RefundType {
  FULL = 'full',
  PARTIAL = 'partial',
}

/**
 * Return reason enum
 */
export enum ReturnReason {
  DEFECTIVE = 'defective',
  WRONG_ITEM = 'wrong_item',
  NOT_AS_DESCRIBED = 'not_as_described',
  NO_LONGER_NEEDED = 'no_longer_needed',
  CHANGED_MIND = 'changed_mind',
  OTHER = 'other',
}

/**
 * Return Request Entity
 * Tracks return requests from buyers
 */
@Entity('return_requests')
export class ReturnRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  orderId: string;

  @Column('uuid')
  buyerId: string;

  @ManyToOne(() => Users, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'buyerId' })
  buyer: Users;

  @Column('uuid')
  sellerId: string;

  @ManyToOne(() => Users, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sellerId' })
  seller: Users;

  @Column({
    type: 'enum',
    enum: ReturnReason,
    default: ReturnReason.OTHER,
  })
  reason: ReturnReason;

  @Column({ type: 'text', nullable: true })
  reasonDescription?: string;

  @Column({
    type: 'enum',
    enum: ReturnStatus,
    default: ReturnStatus.PENDING,
  })
  status: ReturnStatus;

  @Column({
    type: 'enum',
    enum: RefundType,
    default: RefundType.FULL,
  })
  refundType: RefundType;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  requestedAmount?: number;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency: string;

  @Column({ type: 'json', nullable: true })
  items?: Array<{
    listingId: string;
    quantity: number;
    price: number;
  }>;

  @Column({ nullable: true })
  trackingNumber?: string;

  @Column({ type: 'text', nullable: true })
  returnAddress?: string;

  @Column({ nullable: true })
  reviewedBy?: string;

  @Column({ nullable: true })
  reviewNotes?: string;

  @CreateDateColumn()
  requestedAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  reviewedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt?: Date;

  // Days allowed for return (default 30 days from delivery)
  @Column({ type: 'int', default: 30 })
  returnWindowDays: number;
}
