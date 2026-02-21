import { CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Column } from 'typeorm';
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
  // Human-readable decimal in DB
  basePrice: number;

  // Store minor units as integer (string in TS) for blockchain compatibility and deterministic math
  @Column({ type: 'numeric', precision: 40, scale: 0 })
  basePriceMinor: string;

  // Snapshot of rates when price was set (USD-based rates)
  @Column({ type: 'json', nullable: true })
  rateSnapshot?: Record<string, string>;

  @Column({ type: 'timestamptz', nullable: true })
  rateTimestamp?: Date;

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
