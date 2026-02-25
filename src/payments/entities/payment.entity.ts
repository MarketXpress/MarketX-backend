import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Order } from '../../orders/entities/order.entity';
import { PaymentStatus, PaymentCurrency } from '../dto/payment.dto';

@Entity()
@Index(['orderId'])
@Index(['stellarTransactionId'])
@Index(['destinationWalletAddress'])
@Index(['status'])
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  orderId: string;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column({ type: 'decimal', precision: 20, scale: 7 })
  amount: number;

  @Column({
    type: 'enum',
    enum: PaymentCurrency,
  })
  currency: PaymentCurrency;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  status: PaymentStatus;

  @Column({ nullable: true })
  stellarTransactionId?: string;

  @Column()
  destinationWalletAddress: string;

  @Column({ nullable: true })
  sourceWalletAddress?: string;

  @Column({ default: 0 })
  confirmationCount: number;

  @Column({ type: 'integer', default: 30 })
  timeoutMinutes: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  confirmedAt?: Date;

  @Column({ nullable: true })
  failedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt?: Date;

  @Column({ nullable: true })
  failureReason?: string;

  @Column({ type: 'json', nullable: true })
  stellarTransactionData?: Record<string, any>;

  @Column()
  buyerId: string;
}
