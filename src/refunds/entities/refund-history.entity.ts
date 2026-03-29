import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Users } from '../../users/users.entity';
import { RefundType } from './return-request.entity';

/**
 * Refund History Entity
 * Tracks all refund transactions
 */
@Entity('refund_history')
export class RefundHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  returnRequestId: string;

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
    enum: RefundType,
  })
  refundType: RefundType;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  refundAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  originalAmount: number;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency: string;

  @Column({ nullable: true })
  stellarTransactionId?: string;

  @Column({ nullable: true })
  stellarRefundAddress?: string;

  @Column({
    type: 'enum',
    enum: ['pending', 'completed', 'failed'],
    default: 'pending',
  })
  transactionStatus: string;

  @Column({ type: 'text', nullable: true })
  failureReason?: string;

  @Column({ nullable: true })
  processedBy?: string;

  @ManyToOne(() => Users, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'processedBy' })
  processedByUser?: Users;

  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;
}
