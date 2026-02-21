import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateFraudAlerts1680000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'fraud_alerts',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', isGenerated: true },
          { name: 'userId', type: 'varchar', isNullable: true },
          { name: 'orderId', type: 'varchar', isNullable: true },
          { name: 'ip', type: 'varchar', isNullable: true },
          { name: 'deviceFingerprint', type: 'varchar', isNullable: true },
          { name: 'riskScore', type: 'double precision', isNullable: false },
          { name: 'reason', type: 'text', isNullable: true },
          { name: 'status', type: 'varchar', length: '32', default: "'pending'" },
          { name: 'metadata', type: 'json', isNullable: true },
          { name: 'createdAt', type: 'timestamp', default: 'now()' },
        ],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('fraud_alerts');
  }
}
