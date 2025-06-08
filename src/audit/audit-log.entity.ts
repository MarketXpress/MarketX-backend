import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum AuditAction {
  WALLET_REGENERATION = 'WALLET_REGENERATION',
  PROFILE_UPDATE = 'PROFILE_UPDATE',
  PASSWORD_UPDATE = 'PASSWORD_UPDATE',
  LOGIN_ATTEMPT = 'LOGIN_ATTEMPT',
  WALLET_TRANSACTION = 'WALLET_TRANSACTION',
  ACCOUNT_DELETION = 'ACCOUNT_DELETION',
  ROLE_CHANGE = 'ROLE_CHANGE',
}

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  userId: string;

  @Column({
    type: 'enum',
    enum: AuditAction,
  })
  @Index()
  action: AuditAction;

  @CreateDateColumn()
  @Index()
  timestamp: Date;

  @Column({ type: 'jsonb', nullable: true })
  meta: Record<string, any>;

  @Column({ type: 'varchar', nullable: true })
  ipAddress: string;

  @Column({ type: 'varchar', nullable: true })
  userAgent: string;

  @Column({ type: 'varchar', nullable: true })
  status: string;

  @Column({ type: 'text', nullable: true })
  errorMessage: string;
} 