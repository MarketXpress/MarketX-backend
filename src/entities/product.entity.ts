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
import { User } from './user.entity';
import { Category } from '../categories/entities/category.entity';

export enum ProductStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SOLD_OUT = 'sold_out',
  ARCHIVED = 'archived',
}

export enum ProductCondition {
  NEW = 'new',
  LIKE_NEW = 'like_new',
  GOOD = 'good',
  FAIR = 'fair',
  POOR = 'poor',
}

@Entity('products')
@Index(['userId', 'createdAt'])
@Index(['categoryId', 'createdAt'])
@Index(['status', 'createdAt'])
@Index(['price'])
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  @Index()
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  @Index()
  price: number;

  @Column({ length: 3, default: 'USD' })
  currency: string;

  @Column({ length: 255 })
  address: string;

  @Column({ nullable: true })
  categoryId?: number;

  @Column({
    type: 'enum',
    enum: ProductStatus,
    default: ProductStatus.DRAFT,
  })
  @Index()
  status: ProductStatus;

  @Column({
    type: 'enum',
    enum: ProductCondition,
    default: ProductCondition.NEW,
  })
  condition: ProductCondition;

  @Column({ type: 'int', default: 1 })
  @Index()
  quantity: number;

  @Column({ type: 'int', default: 0 })
  reserved: number;

  @Column({ type: 'int', default: 1 })
  @Index()
  available: number;

  @Column({ type: 'simple-array', nullable: true })
  images?: string[];

  @Column({ type: 'simple-array', nullable: true })
  tags?: string[];

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isFeatured: boolean;

  @Column({ default: false })
  isDigital: boolean;

  @Column({ type: 'int', default: 0 })
  @Index()
  views: number;

  @Column({ type: 'int', default: 0 })
  @Index()
  favoritesCount: number;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0 })
  @Index()
  averageRating: number;

  @Column({ type: 'int', default: 0 })
  @Index()
  totalReviews: number;

  @Column({ nullable: true })
  brand?: string;

  @Column({ nullable: true })
  model?: string;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt?: Date;

  // Geospatial data
  @Column({
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
  })
  @Index({ spatial: true })
  location?: string;

  @Column({ default: true })
  shareLocation: boolean;

  @CreateDateColumn()
  @Index()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt?: Date;

  // Foreign Keys
  @Column('uuid')
  @Index()
  userId: string;

  // Relationships
  @ManyToOne(() => User, (user) => user.listings, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => Category, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'categoryId' })
  category?: Category;

  @ManyToMany(() => User, (user) => user.favoriteListings)
  favoritedBy: User[];

  // Computed properties
  get isAvailable(): boolean {
    return this.status === ProductStatus.ACTIVE && this.available > 0;
  }

  get displayPrice(): string {
    return `${this.currency} ${this.price.toFixed(2)}`;
  }
}