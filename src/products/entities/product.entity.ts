import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { SupportedCurrency } from '../services/pricing.service';
import { ProductPriceEntity } from './product-price.entity';

@Entity('products')
@Index('IDX_products_seller_id', ['sellerId'])
@Index('IDX_products_category', ['category'])
@Index('IDX_products_created_at', ['createdAt'])
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  sellerId: string;

  @Column({
    type: 'varchar',
    length: 255,
  })
  name: string;

  @Column({
    type: 'varchar',
    length: 100,
  })
  category: string;

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
    type: 'numeric',
    precision: 20,
    scale: 7,
  })
  price: string;

  @Column({
    type: 'numeric',
    precision: 40,
    scale: 0,
  })
  priceMinor: string;

  @Column({
    type: 'enum',
    enum: SupportedCurrency,
  })
  currency: SupportedCurrency;

  @Column({
    type: 'text',
    nullable: true,
  })
  description?: string;

  @Column({
    type: 'json',
    default: '[]',
  })
  images: string[];

  @CreateDateColumn({
    type: 'timestamptz',
  })
  createdAt: Date;

  @UpdateDateColumn({
    type: 'timestamptz',
  })
  updatedAt: Date;

  @OneToMany(() => ProductPriceEntity, (priceHistory) => priceHistory.product)
  priceHistory: ProductPriceEntity[];
}
