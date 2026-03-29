import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Users } from '../../users/users.entity';

/**
 * Tracks user purchase history for recommendation purposes
 */
@Entity('purchase_history')
@Index(['userId', 'purchasedAt'])
export class PurchaseHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  userId: string;

  @ManyToOne(() => Users, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: Users;

  @Column('uuid')
  orderId: string;

  @Column('uuid')
  listingId: string;

  @Column('int')
  quantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency: string;

  @CreateDateColumn()
  purchasedAt: Date;
}
