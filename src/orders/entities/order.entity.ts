import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { OrderStatus } from '../dto/create-order.dto';
import { SupportedCurrency } from '../../products/services/pricing.service';

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
}