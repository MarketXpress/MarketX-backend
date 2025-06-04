import { MigrationInterface, QueryRunner, Table, Index } from 'typeorm';

export class CreateNotificationsTable1678901234567 implements MigrationInterface {
  name = 'CreateNotificationsTable1678901234567';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'notifications',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'title',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'message',
            type: 'text',
          },
          {
            name: 'type',
            type: 'enum',
            enum: ['info', 'warning', 'error', 'success'],
            default: "'info'",
          },
          {
            name: 'is_read',
            type: 'boolean',
            default: false,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'read_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'recipient_id',
            type: 'int',
          },
        ],
        foreignKeys: [
          {
            columnNames: ['recipient_id'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'notifications',
      new Index('IDX_NOTIFICATIONS_RECIPIENT_ID', ['recipient_id']),
    );

    await queryRunner.createIndex(
      'notifications',
      new Index('IDX_NOTIFICATIONS_IS_READ', ['is_read']),
    );

    await queryRunner.createIndex(
      'notifications',
      new Index('IDX_NOTIFICATIONS_CREATED_AT', ['created_at']),
    );

    // Composite index for common queries
    await queryRunner.createIndex(
      'notifications',
      new Index('IDX_NOTIFICATIONS_RECIPIENT_READ', ['recipient_id', 'is_read']),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('notifications');
  }
}