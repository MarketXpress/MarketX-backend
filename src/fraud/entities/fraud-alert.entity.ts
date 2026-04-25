import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export type FraudStatus =
  | 'pending'
  | 'reviewed'
  | 'suspended'
  | 'safe'
  | 'manual_review';

@Entity({ name: 'fraud_alerts' })
export class FraudAlert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  userId?: string;

  @Column({ nullable: true })
  orderId?: string;

  @Column({ nullable: true })
  ip?: string;

  @Column({ nullable: true })
  deviceFingerprint?: string;

  @Column('float')
  riskScore: number;

  @Column({ type: 'text', nullable: true })
  reason?: string;

  @Column({ type: 'varchar', length: 32, default: 'pending' })
  status: FraudStatus;

  @Column({ type: 'json', nullable: true })
  metadata?: any;

  @Column({ type: 'text', nullable: true })
  lockoutReason?: string;

  @Column({ type: 'timestamp', nullable: true })
  lockoutTimestamp?: Date;

  @Column({ type: 'int', nullable: true })
  lockoutDurationMinutes?: number;

  @Column({ nullable: true })
  reviewedBy?: string;

  @Column({ type: 'timestamp', nullable: true })
  reviewedAt?: Date;

  @Column({ type: 'text', nullable: true })
  reviewNotes?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
