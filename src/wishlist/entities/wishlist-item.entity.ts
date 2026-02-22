import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
  Index,
} from 'typeorm';
import { Wishlist } from './wishlist.entity';

@Entity('wishlist_items')
@Index(['wishlistId'])
@Index(['productId'])
@Index(['wishlistId', 'productId'], { unique: true })
export class WishlistItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  wishlistId: string;

  @ManyToOne(() => Wishlist, (wishlist) => wishlist.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'wishlistId' })
  wishlist: Wishlist;

  @Column()
  productId: string;

  @Column({ length: 255 })
  productName: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  priceAtAdded: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  currentPrice: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  lowestPrice: number | null;

  @Column({ type: 'varchar', nullable: true })
  productImageUrl: string | null;

  @Column({ type: 'varchar', nullable: true })
  productUrl: string | null;

  @Column({ default: true })
  isAvailable: boolean;

  /** Notify user when price drops below this threshold (null = notify on any drop) */
  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  priceAlertThreshold: number | null;

  /** Whether price-drop notifications are enabled for this item */
  @Column({ default: true })
  notificationsEnabled: boolean;

  @Column({ type: 'jsonb', nullable: true })
  priceHistory: Array<{ price: number; recordedAt: string }> | null;

  @CreateDateColumn()
  addedAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}