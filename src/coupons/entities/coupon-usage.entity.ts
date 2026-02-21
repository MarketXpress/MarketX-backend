import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Coupon } from './coupon.entity';

@Entity('coupon_usages')
@Index(['couponId', 'userId'])
@Index(['couponId', 'orderId'])
@Index(['userId'])
@Index(['usedAt'])
export class CouponUsage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  couponId: string;

  @Column('uuid')
  userId: string;

  @Column('uuid')
  orderId: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  orderAmount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  discountAmount: number;

  @Column({ type: 'varchar', length: 10 })
  currency: string;

  @CreateDateColumn()
  usedAt: Date;

  @ManyToOne(() => Coupon, (coupon) => coupon.id, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'couponId' })
  coupon: Coupon;
}
