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
} from 'typeorm';
import { User } from '../../entities/user.entity';

export enum PointsTransactionType {
  EARNED = 'earned',
  REDEEMED = 'redeemed',
  EXPIRED = 'expired',
  ADJUSTED = 'adjusted',
}

@Entity('reward_points')
@Index(['userId'])
@Index(['createdAt'])
export class RewardPoints {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'user_id' })
  @Index()
  userId: string;

  @Column({ type: 'int', default: 0 })
  points: number;

  @Column({
    type: 'enum',
    enum: PointsTransactionType,
    default: PointsTransactionType.EARNED,
  })
  transactionType: PointsTransactionType;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'uuid', nullable: true, name: 'reference_id' })
  referenceId?: string;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'reference_type' })
  referenceType?: string;

  @Column({ type: 'int', default: 0, name: 'balance_after' })
  balanceAfter: number;

  @Column({ type: 'timestamp', nullable: true, name: 'expires_at' })
  expiresAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt?: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
