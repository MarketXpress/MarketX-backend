import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

export enum AuditAction {
  // Wallet Actions
  WALLET_REGENERATION = 'WALLET_REGENERATION',
  WALLET_TRANSACTION = 'WALLET_TRANSACTION',
  
  // Profile Actions
  PROFILE_UPDATE = 'PROFILE_UPDATE',
  PASSWORD_UPDATE = 'PASSWORD_UPDATE',
  EMAIL_UPDATE = 'EMAIL_UPDATE',
  PHONE_UPDATE = 'PHONE_UPDATE',
  
  // Security Actions
  LOGIN_ATTEMPT = 'LOGIN_ATTEMPT',
  LOGOUT = 'LOGOUT',
  TWO_FACTOR_ENABLE = 'TWO_FACTOR_ENABLE',
  TWO_FACTOR_DISABLE = 'TWO_FACTOR_DISABLE',
  
  // Account Actions
  ACCOUNT_DELETION = 'ACCOUNT_DELETION',
  ACCOUNT_SUSPENSION = 'ACCOUNT_SUSPENSION',
  ACCOUNT_REACTIVATION = 'ACCOUNT_REACTIVATION',
  
  // Role & Permission Actions
  ROLE_CHANGE = 'ROLE_CHANGE',
  PERMISSION_CHANGE = 'PERMISSION_CHANGE',
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

  @Column({ type: 'uuid', name: 'user_id' })
  @Index('idx_audit_logs_user_id')
  userId: string;

  @Column({
    type: 'enum',
    enum: AuditAction,
    name: 'action',
  })
  @Index('idx_audit_logs_action')
  action: AuditAction;

  @CreateDateColumn({ name: 'timestamp' })
  @Index('idx_audit_logs_timestamp')
  timestamp: Date;

  @Column({ type: 'jsonb', nullable: true, name: 'meta' })
  meta: Record<string, any>;

  @Column({ type: 'varchar', length: 45, nullable: true, name: 'ip_address' })
  ipAddress: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'user_agent' })
  userAgent: string;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'status' })
  status: string;

  @Column({ type: 'text', nullable: true, name: 'error_message' })
  errorMessage: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @CreateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
} 