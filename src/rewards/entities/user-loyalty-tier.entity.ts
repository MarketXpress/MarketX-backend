import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { User } from '../../entities/user.entity';
import { LoyaltyTier } from './loyalty-tier.entity';

@Entity('user_loyalty_tiers')
@Unique(['userId'])
@Index(['userId'])
@Index(['currentTierId'])
export class UserLoyaltyTier {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'user_id' })
  userId: string;

  @Column('uuid', { name: 'current_tier_id' })
  currentTierId: string;

  @Column({ type: 'int', default: 0, name: 'lifetime_points' })
  lifetimePoints: number;

  @Column({ type: 'int', default: 0, name: 'current_year_points' })
  currentYearPoints: number;

  @Column({ type: 'date', nullable: true, name: 'tier_upgrade_date' })
  tierUpgradeDate?: Date;

  @Column({ type: 'int', default: 0, name: 'months_at_current_tier' })
  monthsAtCurrentTier: number;

  @Column({ type: 'jsonb', nullable: true })
  tierProgress?: {
    pointsToNextTier: number;
    nextTierName: string;
    progressPercentage: number;
  };

  @Column({ type: 'jsonb', nullable: true })
  earnedBenefits?: {
    totalDiscountsEarned: number;
    totalFreeShippingEarned: number;
    totalBonusPointsEarned: number;
  };

  @Column({ type: 'date', nullable: true, name: 'last_activity_date' })
  lastActivityDate?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt?: Date;

  // Relationships
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => LoyaltyTier, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'current_tier_id' })
  currentTier: LoyaltyTier;

  // Helper methods
  updatePoints(points: number): void {
    this.lifetimePoints += points;
    this.currentYearPoints += points;
    this.lastActivityDate = new Date();
  }

  calculateProgressToNextTier(nextTier: LoyaltyTier): void {
    if (!nextTier) {
      this.tierProgress = null;
      return;
    }

    const pointsNeeded = nextTier.minPoints - this.lifetimePoints;
    const currentTierMinPoints = this.currentTier?.minPoints || 0;
    const totalPointsNeeded = nextTier.minPoints - currentTierMinPoints;
    const pointsEarned = this.lifetimePoints - currentTierMinPoints;

    this.tierProgress = {
      pointsToNextTier: Math.max(0, pointsNeeded),
      nextTierName: nextTier.displayName,
      progressPercentage: Math.min(100, (pointsEarned / totalPointsNeeded) * 100),
    };
  }

  isEligibleForTierUpgrade(tier: LoyaltyTier): boolean {
    return this.lifetimePoints >= tier.minPoints && 
           this.currentTierId !== tier.id;
  }
}
