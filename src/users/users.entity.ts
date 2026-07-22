import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import * as bcrypt from 'bcrypt';

export enum VerificationStatus {
  PENDING = 'pending',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
}

export enum VerificationLevel {
  BASIC = 'basic',
  ENHANCED = 'enhanced',
  FULL = 'full',
}

export enum SubscriptionTier {
  FREE = 'free',
  BASIC = 'basic',
  PREMIUM = 'premium',
  ENTERPRISE = 'enterprise',
}

export enum SubscriptionStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
}

@Entity('users')
export class Users {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @Column({ type: 'varchar', nullable: true })
  @Exclude()
  password: string | null;

  @Column()
  name: string;

  @Column({ nullable: true })
  bio: string;

  @Column({ type: 'varchar', nullable: true })
  oauthProvider: string | null;

  @Column({ type: 'varchar', nullable: true, unique: true })
  oauthProviderId: string | null;

  @Column({ nullable: true })
  avatarUrl: string;

  @Column({ nullable: true, default: 'en', length: 5 })
  language: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isBanned: boolean;

  @Column({ nullable: true })
  role: string;

  @ApiProperty({ enum: VerificationStatus })
  @Column({ type: 'enum', enum: VerificationStatus, nullable: true })
  verificationStatus: VerificationStatus;

  @ApiProperty({ enum: VerificationLevel })
  @Column({
    type: 'enum',
    enum: VerificationLevel,
    default: VerificationLevel.BASIC,
  })
  verificationLevel: VerificationLevel;

  @Column({ default: false })
  isVerifiedSeller: boolean;

  @Column({ nullable: true })
  verificationExpiryAt: Date;

  @Column({ default: 0 })
  trustScore: number;

  @ApiProperty({ enum: SubscriptionTier })
  @Column({
    type: 'enum',
    enum: SubscriptionTier,
    default: SubscriptionTier.FREE,
  })
  subscriptionTier: SubscriptionTier;

  @ApiProperty({ enum: SubscriptionStatus })
  @Column({ type: 'enum', enum: SubscriptionStatus, nullable: true })
  subscriptionStatus: SubscriptionStatus;

  @Column({ name: 'subscription_expires_at', nullable: true })
  subscriptionExpiresAt: Date;

  @Column({ name: 'has_premium_subscription', default: false })
  hasPremiumSubscription: boolean;

  @Column({ nullable: true, default: 'active' })
  status: string;

  @Column({ default: false })
  twoFAEnabled: boolean;

  @Column({ nullable: true })
  twoFASecret: string;

  @Column({ nullable: true })
  refreshToken: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt?: Date;

  async validatePassword(password: string): Promise<boolean> {
    if (!this.password) return false;
    return bcrypt.compare(password, this.password);
  }
}
