/* eslint-disable prettier/prettier */
import { Users } from '../../users/users.entity';
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

  @Column({ type: 'int', default: 0 })
  views: number;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date;
}
