import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuditLogsTable1710000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum type for audit actions
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE audit_action_enum AS ENUM (
          'WALLET_REGENERATION',
          'WALLET_TRANSACTION',
          'PROFILE_UPDATE',
          'PASSWORD_UPDATE',
          'EMAIL_UPDATE',
          'PHONE_UPDATE',
          'LOGIN_ATTEMPT',
          'LOGOUT',
          'TWO_FACTOR_ENABLE',
          'TWO_FACTOR_DISABLE',
          'ACCOUNT_DELETION',
          'ACCOUNT_SUSPENSION',
          'ACCOUNT_REACTIVATION',
          'ROLE_CHANGE',
          'PERMISSION_CHANGE'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create audit_logs table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL,
        action audit_action_enum NOT NULL,
        timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        meta JSONB,
        ip_address VARCHAR(45),
        user_agent VARCHAR(255),
        status VARCHAR(50),
        error_message TEXT,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );

      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_status ON audit_logs(status);
      
      -- Create composite indexes for common queries
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user_action ON audit_logs(user_id, action);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user_timestamp ON audit_logs(user_id, timestamp);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_action_timestamp ON audit_logs(action, timestamp);
    `);

    // Add comments to table and columns
    await queryRunner.query(`
      COMMENT ON TABLE audit_logs IS 'Stores audit logs for all sensitive user actions';
      COMMENT ON COLUMN audit_logs.id IS 'Unique identifier for the audit log entry';
      COMMENT ON COLUMN audit_logs.user_id IS 'ID of the user who performed the action';
      COMMENT ON COLUMN audit_logs.action IS 'Type of action performed';
      COMMENT ON COLUMN audit_logs.timestamp IS 'When the action was performed';
      COMMENT ON COLUMN audit_logs.meta IS 'Additional metadata about the action';
      COMMENT ON COLUMN audit_logs.ip_address IS 'IP address of the user';
      COMMENT ON COLUMN audit_logs.user_agent IS 'User agent of the client';
      COMMENT ON COLUMN audit_logs.status IS 'Status of the action (SUCCESS/FAILED)';
      COMMENT ON COLUMN audit_logs.error_message IS 'Error message if the action failed';
      COMMENT ON COLUMN audit_logs.created_at IS 'When the audit log was created';
      COMMENT ON COLUMN audit_logs.updated_at IS 'When the audit log was last updated';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS audit_logs;
      DROP TYPE IF EXISTS audit_action_enum;
    `);
  }
} 