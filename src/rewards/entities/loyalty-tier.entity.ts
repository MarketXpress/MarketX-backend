import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  DeleteDateColumn,
} from 'typeorm';

export enum LoyaltyTierName {
  BRONZE = 'bronze',
  SILVER = 'silver',
  GOLD = 'gold',
  PLATINUM = 'platinum',
  DIAMOND = 'diamond',
}

export interface TierBenefit {
  pointsMultiplier: number;
  discountPercentage: number;
  freeShippingThreshold: number;
  exclusiveAccess: string[];
  birthdayBonus: number;
  anniversaryBonus: number;
}

@Entity('loyalty_tiers')
@Index(['tierName'])
@Index(['minPoints'])
export class LoyaltyTier {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: LoyaltyTierName,
    unique: true,
  })
  tierName: LoyaltyTierName;

  @Column({ type: 'text' })
  displayName: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'int', default: 0, name: 'min_points' })
  minPoints: number;

  @Column({ type: 'int', nullable: true, name: 'max_points' })
  maxPoints?: number;

  @Column({ type: 'jsonb' })
  benefits: TierBenefit;

  @Column({ type: 'varchar', length: 7, default: '#CD7F32' })
  color: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  icon?: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt?: Date;

  // Helper methods
  isInRange(userPoints: number): boolean {
    return userPoints >= this.minPoints && 
           (!this.maxPoints || userPoints <= this.maxPoints);
  }

  calculatePointsEarned(basePoints: number): number {
    return Math.floor(basePoints * this.benefits.pointsMultiplier);
  }

  calculateDiscount(orderAmount: number): number {
    return (orderAmount * this.benefits.discountPercentage) / 100;
  }

  hasFreeShipping(orderAmount: number): boolean {
    return orderAmount >= this.benefits.freeShippingThreshold;
  }
}
