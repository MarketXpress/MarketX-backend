import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export type FraudStatus = 'pending' | 'reviewed' | 'suspended' | 'safe';

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

  @CreateDateColumn()
  createdAt: Date;
}
