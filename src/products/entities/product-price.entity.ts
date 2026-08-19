import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { SupportedCurrency } from '../services/pricing.service';
import { Product } from './product.entity';

@Entity('product_price_history')
export class ProductPriceEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  productId: string;

  @ManyToOne(() => Product, (product) => product.priceHistory, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'productId',
    referencedColumnName: 'id',
  })
  product: Product;

  @Column({
    type: 'numeric',
    precision: 20,
    scale: 7,
  })
  basePrice: string;

  @Column({
    type: 'numeric',
    precision: 40,
    scale: 0,
  })
  basePriceMinor: string;

  @Column({
    type: 'enum',
    enum: SupportedCurrency,
  })
  baseCurrency: SupportedCurrency;

  @Column({
    type: 'json',
    nullable: true,
  })
  rateSnapshot?: Record<SupportedCurrency, string>;

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  rateTimestamp?: Date;

  @Column({
    type: 'uuid',
    nullable: true,
  })
  updatedBy?: string;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  reason?: string;

  @CreateDateColumn({
    type: 'timestamptz',
  })
  createdAt: Date;
}
