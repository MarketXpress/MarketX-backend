import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  DeleteDateColumn,
} from 'typeorm';
import { User } from './user.entity';
import { SupportedCurrency } from '../products/services/pricing.service';
import { PaymentStatus } from '../payments/dto/payment.dto';

export enum OrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  PROCESSING = 'processing',
  PAID = 'paid',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
  MANUAL_REVIEW = 'manual_review',
}

export enum EscrowType {
  STANDARD = 'standard',
  MILESTONE = 'milestone',
}

export interface OrderItem {
  productId: string;
  variantId?: string;
  productName: string;
  quantity: number;
  price: number;
  subtotal: number;
  priceCurrency: SupportedCurrency;
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

  @Column({ name: 'shipping_address', length: 255, nullable: true })
  shippingAddress?: string;

  @Column({ nullable: true, length: 100 })
  trackingNumber?: string;

  @Column({ nullable: true, length: 500 })
  notes?: string;

  @Column({ nullable: true, length: 500 })
  cancellationReason?: string;

  @Column({ nullable: true })
  expectedDeliveryDate?: Date;

  @Column({
    type: 'varchar',
    length: 3,
    default: SupportedCurrency.USD,
  })
  currency: SupportedCurrency;

  @Column({ name: 'escrow_type', type: 'varchar', length: 20, nullable: true })
  escrowType?: EscrowType;

  @Column({ type: 'jsonb', nullable: true })
  milestones?: Array<{
    title: string;
    description: string;
    amount: number;
    percentage: number;
    type: string;
    trigger: string;
    autoRelease: boolean;
    sortOrder: number;
  }>;

  @Column({
    name: 'released_amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  releasedAmount: number;

  @Column({
    name: 'remaining_amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  remainingAmount: number;

  @CreateDateColumn({ name: 'created_at' })
  @Index()
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt?: Date;

  @Column({ name: 'confirmed_at', nullable: true })
  confirmedAt?: Date;

  @Column({ name: 'shipped_at', nullable: true })
  shippedAt?: Date;

  @Column({ name: 'delivered_at', nullable: true })
  deliveredAt?: Date;

  @Column({ name: 'completed_at', nullable: true })
  completedAt?: Date;

  @Column({ name: 'cancelled_at', nullable: true })
  cancelledAt?: Date;

  @Column({ name: 'refunded_at', nullable: true })
  refundedAt?: Date;

  @Column('uuid', { name: 'buyer_id' })
  @Index()
  buyerId: string;

  @Column({ name: 'seller_id', type: 'uuid', nullable: true })
  @Index()
  sellerId?: string;

  @ManyToOne(() => User, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'buyer_id' })
  buyer: User;

  @ManyToOne(() => User, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'seller_id' })
  seller?: User;

  get orderId(): string {
    return this.id;
  }

  get orderDate(): Date {
    return this.createdAt;
  }

  get customerName(): string {
    return this.buyer ? `${this.buyer.firstName} ${this.buyer.lastName}`.trim() : '';
  }

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
    return `$${Number(this.totalAmount).toFixed(2)}`;
  }
}
