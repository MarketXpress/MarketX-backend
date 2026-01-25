import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';
import { Order } from './order.entity';

export enum TransactionStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  REVERSED = 'reversed',
}

export enum TransactionType {
  TRANSFER = 'transfer',
  PAYMENT = 'payment',
  REFUND = 'refund',
  PURCHASE = 'purchase',
  WITHDRAWAL = 'withdrawal',
  DEPOSIT = 'deposit',
  FEE = 'fee',
}

export enum PaymentMethod {
  STELLAR = 'stellar',
  CREDIT_CARD = 'credit_card',
  BANK_TRANSFER = 'bank_transfer',
  WALLET = 'wallet',
}

@Entity('transactions')
@Index(['senderId', 'createdAt'])
@Index(['receiverId', 'createdAt'])
@Index(['orderId', 'createdAt'])
@Index(['status', 'createdAt'])
@Index(['type', 'createdAt'])
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'decimal', precision: 15, scale: 7 })
  @Index()
  amount: number;

  @Column({ length: 3, default: 'USD' })
  currency: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.PENDING,
  })
  @Index()
  status: TransactionStatus;

  @Column({
    type: 'enum',
    enum: TransactionType,
    default: TransactionType.TRANSFER,
  })
  @Index()
  type: TransactionType;

  @Column({
    type: 'enum',
    enum: PaymentMethod,
    default: PaymentMethod.STELLAR,
  })
  paymentMethod: PaymentMethod;

  @Column('uuid')
  @Index()
  senderId: string;

  @Column('uuid')
  @Index()
  receiverId: string;

  @Column({ nullable: true })
  @Index()
  orderId?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @Column({ nullable: true, length: 100 })
  referenceId?: string;

  @Column({ nullable: true, length: 64 })
  externalReference?: string;

  @Column({ nullable: true, length: 64 })
  stellarHash?: string;

  @Column({ type: 'decimal', precision: 10, scale: 7, default: 0 })
  feeAmount: number;

  @Column({ length: 3, default: 'USD' })
  feeCurrency: string;

  @Column({ nullable: true, length: 500 })
  failureReason?: string;

  @CreateDateColumn()
  @Index()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  processedAt?: Date;

  @Column({ nullable: true })
  completedAt?: Date;

  @Column({ nullable: true })
  failedAt?: Date;

  @Column({ nullable: true })
  reversedAt?: Date;

  // Relationships
  @ManyToOne(() => User, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'senderId' })
  sender: User;

  @ManyToOne(() => User, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'receiverId' })
  receiver: User;

  @ManyToOne(() => Order, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'orderId' })
  order?: Order;

  // Computed properties
  get netAmount(): number {
    return this.amount - this.feeAmount;
  }

  get displayAmount(): string {
    return `${this.currency} ${this.amount.toFixed(7)}`;
  }

  get displayFee(): string {
    return `${this.feeCurrency} ${this.feeAmount.toFixed(7)}`;
  }

  get isSuccessful(): boolean {
    return this.status === TransactionStatus.COMPLETED;
  }

  get isPending(): boolean {
    return this.status === TransactionStatus.PENDING || this.status === TransactionStatus.PROCESSING;
  }
}