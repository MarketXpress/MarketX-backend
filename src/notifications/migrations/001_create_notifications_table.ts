import { MigrationInterface, QueryRunner, Table, Index } from 'typeorm';

export class CreateNotificationsTable1640000000000 implements MigrationInterface {
  name = 'CreateNotificationsTable1640000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'notifications',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'user_id',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'title',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'message',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'read',
            type: 'boolean',
            default: false,
          },
          {
            name: 'type',
            type: 'enum',
            enum: [
              'transaction_received',
              'transaction_sent',
              'payment_success',
              'payment_failed',
              'system_alert',
              'account_update',
              'security_alert',
              'promotion',
              'reminder',
            ],
            default: "'system_alert'",
          },
          {
            name: 'channel',
            type: 'enum',
            enum: ['in_app', 'email', 'sms', 'push'],
            default: "'in_app'",
          },
          {
            name: 'priority',
            type: 'enum',
            enum: ['low', 'medium', 'high', 'urgent'],
            default: "'medium'",
          },
          {
            name: 'metadata',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'related_entity_id',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'related_entity_type',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'scheduled_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'sent_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'read_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'expires_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true
    );

    // Create indexes
    await queryRunner.createIndex(
      'notifications',
      new Index('IDX_notifications_user_id_created_at', ['user_id', 'created_at'])
    );

    await queryRunner.createIndex(
      'notifications',
      new Index('IDX_notifications_read_created_at', ['read', 'created_at'])
    );

    await queryRunner.createIndex(
      'notifications',
      new Index('IDX_notifications_user_id', ['user_id'])
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('notifications');
  }
}