import {
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Column,
} from 'typeorm';
import { SupportedCurrency } from '../services/pricing.service';

@Entity('product_prices')
@Index(['productId', 'createdAt'])
export class ProductPriceEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  @Index()
  productId: string;

  @Column({ type: 'decimal', precision: 20, scale: 7 })
  basePrice: number;

  @Column({
    type: 'enum',
    enum: SupportedCurrency,
  })
  baseCurrency: SupportedCurrency;

  @Column({ nullable: true })
  updatedBy?: string;

  @Column({ nullable: true })
  reason?: string;

  @CreateDateColumn()
  createdAt: Date;
}
