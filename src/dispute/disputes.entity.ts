import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum DisputeStatus {
  OPEN = 'OPEN',
  UNDER_REVIEW = 'UNDER_REVIEW',
  RESOLVED = 'RESOLVED',
}

export enum ResolutionAction {
  REFUND_TO_BUYER = 'REFUND_TO_BUYER',
  RELEASE_TO_SELLER = 'RELEASE_TO_SELLER',
}

@Entity('disputes')
export class Dispute {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'order_id' })
  orderId: string;

  // Aligned to match our production sequential integer user identity column type
  @Column({ name: 'raised_by', type: 'integer' })
  raisedBy: number;

  @Column({ type: 'text' })
  reason: string;

  @Column({
    type: 'enum',
    enum: DisputeStatus,
    default: DisputeStatus.OPEN,
  })
  status: DisputeStatus;

  @Column({ type: 'text', nullable: true })
  resolution?: string;

  @Column({
    type: 'enum',
    enum: ResolutionAction,
    nullable: true,
  })
  resolutionAction?: ResolutionAction;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
