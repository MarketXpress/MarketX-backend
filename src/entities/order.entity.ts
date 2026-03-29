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
import { Product } from './product.entity';

export enum OrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  PROCESSING = 'processing',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
}

export enum PaymentStatus {
  UNPAID = 'unpaid',
  PAID = 'paid',
  PARTIALLY_PAID = 'partially_paid',
  REFUNDED = 'refunded',
  FAILED = 'failed',
}

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  subtotal: number;
}

@Entity('orders')
@Index(['buyerId', 'createdAt'])
@Index(['sellerId', 'createdAt'])
@Index(['status', 'createdAt'])
@Index(['paymentStatus', 'createdAt'])
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  @Index()
  totalAmount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  taxAmount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  shippingCost: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  discountAmount: number;

  @Column({
    type: 'enum',
    enum: OrderStatus,
    default: OrderStatus.PENDING,
  })
  @Index()
  status: OrderStatus;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.UNPAID,
  })
  @Index()
  paymentStatus: PaymentStatus;

  @Column({ type: 'jsonb' })
  items: OrderItem[];

  @Column({ length: 255 })
  shippingAddress: string;

  @Column({ nullable: true, length: 100 })
  trackingNumber?: string;

  @Column({ nullable: true, length: 500 })
  notes?: string;

  @Column({ nullable: true, length: 500 })
  cancellationReason?: string;

  @Column({ nullable: true })
  expectedDeliveryDate?: Date;

  @CreateDateColumn()
  @Index()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  confirmedAt?: Date;

  @Column({ nullable: true })
  shippedAt?: Date;

  @Column({ nullable: true })
  deliveredAt?: Date;

  @Column({ nullable: true })
  completedAt?: Date;

  @Column({ nullable: true })
  cancelledAt?: Date;

  @Column({ nullable: true })
  refundedAt?: Date;

  // Foreign Keys
  @Column('uuid')
  @Index()
  buyerId: string;

  @Column({ nullable: true })
  @Index()
  sellerId?: string;

  // Relationships
  @ManyToOne(() => User, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'buyerId' })
  buyer: User;

  @ManyToOne(() => User, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'sellerId' })
  seller?: User;

  // Computed properties
  get itemCount(): number {
    return this.items.reduce((sum, item) => sum + item.quantity, 0);
  }

  get isCompleted(): boolean {
    return this.status === OrderStatus.COMPLETED;
  }

  get isCancelled(): boolean {
    return this.status === OrderStatus.CANCELLED;
  }

  get displayTotal(): string {
    return `$${this.totalAmount.toFixed(2)}`;
  }
}
