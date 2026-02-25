import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('wishlists')
export class Wishlist {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column({ length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ default: false })
  isPublic: boolean;

  @Column({ type: 'varchar', nullable: true, unique: true })
  shareToken: string | null;

  @OneToMany(() => WishlistItem, (item) => item.wishlist, {
    cascade: true,
    eager: false,
  })
  items: WishlistItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

// Avoid circular import by co-locating a forward reference
import { WishlistItem } from './wishlist-item.entity';