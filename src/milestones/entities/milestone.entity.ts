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
import { Order } from '../../orders/entities/order.entity';
import { MilestoneStatus, MilestoneType, MilestoneTrigger } from '../enums/milestone.enums';

@Entity('milestones')
@Index(['orderId', 'status'])
@Index(['status', 'releaseAt'])
export class Milestone {
  @ApiProperty({ description: 'Milestone ID' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Order ID' })
  @Column({ name: 'order_id' })
  @Index()
  orderId: string;

  @ApiProperty({ description: 'Milestone title' })
  @Column({ length: 255 })
  title: string;

  @ApiProperty({ description: 'Milestone description' })
  @Column('text')
  description: string;

  @ApiProperty({ description: 'Milestone amount' })
  @Column('decimal', { precision: 20, scale: 2 })
  amount: number;

  @ApiProperty({ description: 'Milestone percentage of total order' })
  @Column('decimal', { precision: 5, scale: 2 })
  percentage: number;

  @ApiProperty({ description: 'Milestone status', enum: MilestoneStatus })
  @Column({
    type: 'enum',
    enum: MilestoneStatus,
    default: MilestoneStatus.PENDING,
  })
  status: MilestoneStatus;

  @ApiProperty({ description: 'Milestone type', enum: MilestoneType })
  @Column({
    type: 'enum',
    enum: MilestoneType,
    default: MilestoneType.CUSTOM,
  })
  type: MilestoneType;

  @ApiProperty({ description: 'Milestone trigger', enum: MilestoneTrigger })
  @Column({
    type: 'enum',
    enum: MilestoneTrigger,
    default: MilestoneTrigger.MANUAL,
  })
  trigger: MilestoneTrigger;

  @ApiProperty({ description: 'Automatic release enabled' })
  @Column({ name: 'auto_release', default: false })
  autoRelease: boolean;

  @ApiProperty({ description: 'Scheduled release date' })
  @Column({ name: 'release_at', type: 'timestamp', nullable: true })
  releaseAt: Date;

  @ApiProperty({ description: 'Actual release date' })
  @Column({ name: 'released_at', type: 'timestamp', nullable: true })
  releasedAt: Date;

  @ApiProperty({ description: 'Release transaction ID' })
  @Column({ name: 'release_transaction_id', nullable: true })
  releaseTransactionId: string;

  @ApiProperty({ description: 'Required documents for release' })
  @Column('json', { nullable: true })
  requiredDocuments: string[];

  @ApiProperty({ description: 'Uploaded documents' })
  @Column('json', { nullable: true })
  uploadedDocuments: Array<{
    id: string;
    name: string;
    url: string;
    uploadedAt: Date;
  }>;

  @ApiProperty({ description: 'Release conditions' })
  @Column('json', { nullable: true })
  releaseConditions: string[];

  @ApiProperty({ description: 'Admin notes' })
  @Column('text', { nullable: true })
  adminNotes: string;

  @ApiProperty({ description: 'Rejection reason' })
  @Column({ name: 'rejection_reason', nullable: true })
  rejectionReason: string;

  @ApiProperty({ description: 'Dispute details' })
  @Column('json', { nullable: true })
  disputeDetails: {
    reason: string;
    description: string;
    evidence: string[];
    raisedBy: string;
    raisedAt: Date;
  };

  @ApiProperty({ description: 'Sort order for milestone sequence' })
  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;

  @ApiProperty({ description: 'Milestone metadata' })
  @Column('json', { nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Order, { eager: false })
  @JoinColumn({ name: 'orderId' })
  order: Order;
}
