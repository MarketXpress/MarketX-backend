import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SupportedCurrency } from '../../products/services/pricing.service';
import { OrderStatus } from '../dto/create-order.dto';

export enum EscrowType {
  STANDARD = 'standard',
  MILESTONE = 'milestone',
}

@Entity()
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'decimal', precision: 20, scale: 7 })
  totalAmount: number;

  @Column({
    type: 'enum',
    enum: SupportedCurrency,
    default: SupportedCurrency.USD,
  })
  currency: SupportedCurrency;

  @Column({
    type: 'enum',
    enum: OrderStatus,
    default: OrderStatus.PENDING,
  })
  status: OrderStatus;

  @Column({ nullable: true })
  trackingNumber?: string;

  @Column({ type: 'json', default: [] })
  items: Array<{
    productId: string;
    variantId?: string;
    productName: string;
    quantity: number;
    price: number;
    subtotal: number;
    priceCurrency: SupportedCurrency;
  }>;

  @Column()
  buyerId: string;

  @Column({ nullable: true })
  sellerId?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  cancelledAt?: Date;

  @Column({ nullable: true })
  shippedAt?: Date;

  @Column({ nullable: true })
  deliveredAt?: Date;

  @Column({ nullable: true })
  escrowType?: EscrowType;

  @Column({ type: 'json', nullable: true })
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
    precision: 20,
    scale: 2,
    default: 0,
  })
  releasedAmount: number;

  @Column({
    name: 'remaining_amount',
    type: 'decimal',
    precision: 20,
    scale: 2,
  })
  remainingAmount: number;

  @DeleteDateColumn()
  deletedAt?: Date;
}
