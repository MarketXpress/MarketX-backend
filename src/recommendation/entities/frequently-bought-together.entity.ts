import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * Tracks frequently bought together products for recommendation
 */
@Entity('frequently_bought_together')
@Index(['listingIdA', 'listingIdB'])
export class FrequentlyBoughtTogether {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  listingIdA: string;

  @Column('uuid')
  listingIdB: string;

  @Column({ type: 'int', default: 1 })
  purchaseCount: number; // Number of times these items were purchased together

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  confidence: number; // Confidence score (0-1) based on purchase frequency

  @CreateDateColumn()
  updatedAt: Date;
}
