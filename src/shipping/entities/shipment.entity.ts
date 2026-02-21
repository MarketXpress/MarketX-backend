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
import { ShippingCarrier, ShipmentStatus } from '../dto/create-shipment.dto';

@Entity()
@Index(['orderId'])
@Index(['trackingNumber'])
@Index(['status'])
@Index(['carrier'])
export class Shipment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  orderId: string;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column({
    type: 'enum',
    enum: ShippingCarrier,
  })
  carrier: ShippingCarrier;

  @Column()
  trackingNumber: string;

  @Column({
    type: 'enum',
    enum: ShipmentStatus,
    default: ShipmentStatus.LABEL_CREATED,
  })
  status: ShipmentStatus;

  @Column({ type: 'json' })
  shippingAddress: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  weight?: number;

  @Column({ type: 'json', nullable: true })
  dimensions?: {
    length: number;
    width: number;
    height: number;
    unit?: string;
  };

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  shippingCost?: number;

  @Column({ type: 'timestamp', nullable: true })
  estimatedDeliveryDate?: Date;

  @Column({ type: 'timestamp', nullable: true })
  actualDeliveryDate?: Date;

  @Column({ nullable: true })
  labelUrl?: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
