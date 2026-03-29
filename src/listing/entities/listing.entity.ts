import { Users } from '../../users/users.entity';
import { ListingVariant } from './listing-variant.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToMany,
  OneToMany,
  Index,
} from 'typeorm';

@Entity('listings')
export class Listing {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency: string;

  @Column({ type: 'varchar', length: 255 })
  address: string;

  @Column({ nullable: true })
  category: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'int', default: 1 })
  quantity: number;

  @Column({ type: 'int', default: 0 })
  reserved: number;

  @Column({ type: 'int', default: 1 })
  available: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt?: Date;

  @ManyToOne(() => Users, (user) => user.listings, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: Users;

  @Column('uuid')
  userId: string;

  // Use geography Point type for geospatial queries
  @Column({
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
  })
  @Index({ spatial: true })
  location: string;

  // Optional: privacy setting example
  @Column({ default: true })
  shareLocation: boolean;

  @ManyToMany(() => Users, (user) => user.favoriteListings)
  favoritedBy: Users[];

  @OneToMany(() => ListingVariant, (variant) => variant.listing, {
    cascade: true,
    eager: true,
  })
  variants?: ListingVariant[];

  @Column({ type: 'int', default: 0 })
  views: number;

  get aggregatedQuantity(): number {
    if (!this.variants || this.variants.length === 0) {
      return this.quantity;
    }
    return this.variants.reduce((sum, variant) => sum + variant.quantity, 0);
  }

  get aggregatedReserved(): number {
    if (!this.variants || this.variants.length === 0) {
      return this.reserved;
    }
    return this.variants.reduce((sum, variant) => sum + variant.reserved, 0);
  }

  get aggregatedAvailable(): number {
    if (!this.variants || this.variants.length === 0) {
      return this.available;
    }
    return this.variants.reduce((sum, variant) => sum + variant.available, 0);
  }

  get minVariantPrice(): number {
    if (!this.variants || this.variants.length === 0) {
      return Number(this.price);
    }
    return Math.min(...this.variants.map((variant) => Number(variant.price)));
  }

  get variantCurrency(): string {
    if (!this.variants || this.variants.length === 0) {
      return this.currency;
    }
    return this.variants[0].currency;
  }

  @Column({ default: false })
  isFeatured: boolean;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date;
}
