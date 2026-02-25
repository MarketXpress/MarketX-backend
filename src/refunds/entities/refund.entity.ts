import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { Order } from '../../orders/entities/order.entity';
import { User } from '../../users/entities/user.entity';

export enum RefundStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  PROCESSED = 'PROCESSED',
  FAILED = 'FAILED',
}

export enum RefundType {
  FULL = 'FULL',
  PARTIAL = 'PARTIAL',
}

export enum ReturnReason {
  DEFECTIVE = 'DEFECTIVE',
  NOT_AS_DESCRIBED = 'NOT_AS_DESCRIBED',
  WRONG_ITEM = 'WRONG_ITEM',
  CHANGED_MIND = 'CHANGED_MIND',
  DAMAGED_SHIPPING = 'DAMAGED_SHIPPING',
  OTHER = 'OTHER',
}

@Entity('refunds')
export class Refund {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Order, { eager: true })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({ name: 'order_id' })
  orderId: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'buyer_id' })
  buyer: User;

  @Column({ name: 'buyer_id' })
  buyerId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'reviewed_by' })
  reviewedBy: User;

  @Column({ name: 'reviewed_by', nullable: true })
  reviewedById: string;

  @Column({ type: 'enum', enum: RefundType })
  type: RefundType;

  @Column({ type: 'enum', enum: RefundStatus, default: RefundStatus.PENDING })
  status: RefundStatus;

  @Column({ type: 'enum', enum: ReturnReason })
  reason: ReturnReason;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'decimal', precision: 18, scale: 7 })
  requestedAmount: number;

  @Column({ type: 'decimal', precision: 18, scale: 7, nullable: true })
  approvedAmount: number;

  @Column({ nullable: true })
  stellarTransactionHash: string;

  @Column({ type: 'text', nullable: true })
  adminNotes: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  processedAt: Date;
}
