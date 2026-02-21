import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Users } from '../../users/users.entity';
import { 
  SubscriptionTier, 
  SubscriptionStatus, 
  BillingCycle 
} from '../enums/subscription.enums';

@Entity('subscriptions')
@Index(['userId', 'status'])
@Index(['status', 'expiresAt'])
export class Subscription {
  @ApiProperty({ description: 'Subscription ID' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'User ID' })
  @Column({ name: 'user_id' })
  @Index()
  userId: number;

  @ApiProperty({ description: 'Subscription tier', enum: SubscriptionTier })
  @Column({ type: 'enum', enum: SubscriptionTier })
  tier: SubscriptionTier;

  @ApiProperty({ description: 'Subscription status', enum: SubscriptionStatus })
  @Column({ type: 'enum', enum: SubscriptionStatus, default: SubscriptionStatus.PENDING })
  status: SubscriptionStatus;

  @ApiProperty({ description: 'Billing cycle', enum: BillingCycle })
  @Column({ type: 'enum', enum: BillingCycle, default: BillingCycle.MONTHLY })
  billingCycle: BillingCycle;

  @ApiProperty({ description: 'Subscription price at time of purchase' })
  @Column('decimal', { precision: 10, scale: 2 })
  price: number;

  @ApiProperty({ description: 'Currency code' })
  @Column({ length: 3, default: 'USD' })
  currency: string;

  @ApiProperty({ description: 'Subscription start date' })
  @Column({ name: 'starts_at', type: 'timestamp' })
  startsAt: Date;

  @ApiProperty({ description: 'Subscription end date' })
  @Column({ name: 'ends_at', type: 'timestamp', nullable: true })
  endsAt: Date;

  @ApiProperty({ description: 'Subscription expiry date for renewal' })
  @Column({ name: 'expires_at', type: 'timestamp' })
  expiresAt: Date;

  @ApiProperty({ description: 'Trial end date if applicable' })
  @Column({ name: 'trial_ends_at', type: 'timestamp', nullable: true })
  trialEndsAt: Date;

  @ApiProperty({ description: 'Last payment date' })
  @Column({ name: 'last_payment_at', type: 'timestamp', nullable: true })
  lastPaymentAt: Date;

  @ApiProperty({ description: 'Next billing date' })
  @Column({ name: 'next_billing_at', type: 'timestamp', nullable: true })
  nextBillingAt: Date;

  @ApiProperty({ description: 'Payment method token' })
  @Column({ name: 'payment_method_token', nullable: true })
  paymentMethodToken: string;

  @ApiProperty({ description: 'Payment provider' })
  @Column({ name: 'payment_provider', nullable: true })
  paymentProvider: string;

  @ApiProperty({ description: 'External subscription ID from payment provider' })
  @Column({ name: 'external_subscription_id', nullable: true })
  externalSubscriptionId: string;

  @ApiProperty({ description: 'Auto-renewal enabled' })
  @Column({ name: 'auto_renew', default: true })
  autoRenew: boolean;

  @ApiProperty({ description: 'Cancellation reason' })
  @Column({ name: 'cancellation_reason', nullable: true })
  cancellationReason: string;

  @ApiProperty({ description: 'Cancellation date' })
  @Column({ name: 'cancelled_at', type: 'timestamp', nullable: true })
  cancelledAt: Date;

  @ApiProperty({ description: 'Usage statistics and limits' })
  @Column('json', { nullable: true })
  usage: {
    currentListings: number;
    currentFeaturedListings: number;
    totalUploadsThisMonth: number;
    lastUsageReset: Date;
  };

  @ApiProperty({ description: 'Subscription metadata' })
  @Column('json', { nullable: true })
  metadata: Record<string, any>;

  @ApiProperty({ description: 'Grace period end date' })
  @Column({ name: 'grace_period_ends_at', type: 'timestamp', nullable: true })
  gracePeriodEndsAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Users, { eager: false })
  @JoinColumn({ name: 'userId' })
  user: Users;
}
