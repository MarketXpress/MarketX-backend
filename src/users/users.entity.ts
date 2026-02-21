import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { Listing } from '../listing/entities/listing.entity';
import {
  VerificationLevel,
  VerificationStatus,
} from '../verification/enums/verification.enums';
import {
  SubscriptionTier,
  SubscriptionStatus,
} from '../subscriptions/enums/subscription.enums';
import * as bcrypt from 'bcrypt';

@Entity('users')
export class Users {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @Column()
  @Exclude()
  password: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  bio: string;

  @Column({ nullable: true })
  avatarUrl: string;

  @Column({ nullable: true })
  language: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  role: string;

  @ApiProperty({
    description: 'User verification status',
    enum: VerificationStatus,
  })
  @Column({ type: 'enum', enum: VerificationStatus, nullable: true })
  verificationStatus: VerificationStatus;

  @ApiProperty({
    description: 'User verification level',
    enum: VerificationLevel,
  })
  @Column({
    type: 'enum',
    enum: VerificationLevel,
    default: VerificationLevel.BASIC,
  })
  verificationLevel: VerificationLevel;

  @ApiProperty({ description: 'Is user a verified seller' })
  @Column({ default: false })
  isVerifiedSeller: boolean;

  @ApiProperty({ description: 'Verification expiry date' })
  @Column({ nullable: true })
  verificationExpiryAt: Date;

  @ApiProperty({ description: 'Trust score based on verifications' })
  @Column({ default: 0 })
  trustScore: number;

  @ApiProperty({
    description: 'Current subscription tier',
    enum: SubscriptionTier,
  })
  @Column({
    type: 'enum',
    enum: SubscriptionTier,
    default: SubscriptionTier.FREE,
  })
  subscriptionTier: SubscriptionTier;

  @ApiProperty({ description: 'Subscription status', enum: SubscriptionStatus })
  @Column({ type: 'enum', enum: SubscriptionStatus, nullable: true })
  subscriptionStatus: SubscriptionStatus;

  @ApiProperty({ description: 'Subscription expiry date' })
  @Column({ name: 'subscription_expires_at', nullable: true })
  subscriptionExpiresAt: Date;

  @ApiProperty({ description: 'Has active premium subscription' })
  @Column({ name: 'has_premium_subscription', default: false })
  hasPremiumSubscription: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Listing, (listing) => listing.user)
  listings: Listing[];

  @ManyToMany(() => Listing, (listing) => listing.favoritedBy)
  @JoinTable({
    name: 'user_favorites',
    joinColumn: {
      name: 'user_id',
      referencedColumnName: 'id',
    },
    inverseJoinColumn: {
      name: 'listing_id',
      referencedColumnName: 'id',
    },
  })
  favoriteListings: Listing[];

  async validatePassword(password: string): Promise<boolean> {
    return bcrypt.compare(password, this.password);
  }
}
