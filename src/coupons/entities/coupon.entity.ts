import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  DeleteDateColumn,
} from 'typeorm';

export enum DiscountType {
  PERCENTAGE = 'percentage',
  FIXED_AMOUNT = 'fixed_amount',
}

export enum CouponStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  EXPIRED = 'expired',
  DEPLETED = 'depleted',
}

export interface CouponRestriction {
  productIds?: string[];
  categoryIds?: string[];
  excludedProductIds?: string[];
  excludedCategoryIds?: string[];
  minimumOrderAmount?: number;
  maximumDiscountAmount?: number;
  newCustomersOnly?: boolean;
  firstOrderOnly?: boolean;
}

@Entity('coupons')
@Index(['code'])
@Index(['status'])
@Index(['startDate', 'endDate'])
export class Coupon {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({
    type: 'enum',
    enum: DiscountType,
    default: DiscountType.PERCENTAGE,
  })
  discountType: DiscountType;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  discountValue: number;

  @Column({
    type: 'enum',
    enum: CouponStatus,
    default: CouponStatus.ACTIVE,
  })
  status: CouponStatus;

  @Column({ type: 'timestamp', nullable: true })
  startDate?: Date;

  @Column({ type: 'timestamp', nullable: true })
  endDate?: Date;

  @Column({ type: 'int', default: 0 })
  totalUsageLimit: number;

  @Column({ type: 'int', default: 0 })
  perUserLimit: number;

  @Column({ type: 'int', default: 0 })
  currentUsageCount: number;

  @Column({ type: 'jsonb', nullable: true })
  restrictions?: CouponRestriction;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt?: Date;

  // Helper methods
  isValid(): boolean {
    const now = new Date();

    if (this.status !== CouponStatus.ACTIVE) {
      return false;
    }

    if (this.startDate && now < this.startDate) {
      return false;
    }

    if (this.endDate && now > this.endDate) {
      return false;
    }

    if (this.totalUsageLimit > 0 && this.currentUsageCount >= this.totalUsageLimit) {
      return false;
    }

    return true;
  }

  isExpired(): boolean {
    if (this.endDate && new Date() > this.endDate) {
      return true;
    }
    return false;
  }

  isDepleted(): boolean {
    return this.totalUsageLimit > 0 && this.currentUsageCount >= this.totalUsageLimit;
  }

  calculateDiscount(orderAmount: number): number {
    let discount = 0;

    if (this.discountType === DiscountType.PERCENTAGE) {
      discount = (orderAmount * this.discountValue) / 100;
    } else {
      discount = this.discountValue;
    }

    // Apply maximum discount restriction if set
    if (this.restrictions?.maximumDiscountAmount && discount > this.restrictions.maximumDiscountAmount) {
      discount = this.restrictions.maximumDiscountAmount;
    }

    // Discount cannot exceed order amount
    return Math.min(discount, orderAmount);
  }
}
