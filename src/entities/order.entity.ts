import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';
import { SupportedCurrency } from '../products/services/pricing.service';

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

export enum PaymentStatus {
  UNPAID = 'unpaid',
  PAID = 'paid',
  PARTIALLY_PAID = 'partially_paid',
  REFUNDED = 'refunded',
  FAILED = 'failed',
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

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.PENDING })
  @Index()
  status: OrderStatus;

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.UNPAID })
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

  @Column({ type: 'varchar', length: 3, default: SupportedCurrency.USD })
  currency: SupportedCurrency;

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
}
