import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum AuditActionType {
  CREATE = 'CREATE',
  READ = 'READ',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
  EMAIL_CHANGE = 'EMAIL_CHANGE',
  PERMISSION_CHANGE = 'PERMISSION_CHANGE',
  WITHDRAWAL = 'WITHDRAWAL',
  DEPOSIT = 'DEPOSIT',
  SYSTEM = 'SYSTEM',
  FRAUD_ALERT = 'FRAUD_ALERT',
  FRAUD_LOCKOUT = 'FRAUD_LOCKOUT',
  FRAUD_REVIEW = 'FRAUD_REVIEW',
}

export enum AuditStatus {
  SUCCESS = 'SUCCESS',
  FAILURE = 'FAILURE',
  WARNING = 'WARNING',
}

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  userId: string;

  @Index()
  @Column({
    type: 'enum',
    enum: AuditActionType,
    default: AuditActionType.SYSTEM,
  })
  action: AuditActionType;

  @Column({
    type: 'enum',
    enum: AuditStatus,
    default: AuditStatus.SUCCESS,
  })
  status: AuditStatus;

  @Column({ type: 'jsonb', nullable: true })
  details: Record<string, any>;

  @Column({ nullable: true })
  resourceType: string;

  @Column({ nullable: true })
  resourceId: string;

  @Column({ nullable: true })
  ipAddress: string;

  @Column({ nullable: true })
  userAgent: string;

  @Column({ nullable: true })
  errorMessage: string;

  @Column({ type: 'int', nullable: true })
  responseTime: number;

  @Column({ type: 'jsonb', nullable: true })
  statePreviousValue: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  stateNewValue: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  stateDiff: Record<string, { previous: any; new: any }>;

  @Column({ nullable: true })
  changedFields: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date;
}
