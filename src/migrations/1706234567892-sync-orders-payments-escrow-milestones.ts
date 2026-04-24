import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class SyncOrdersPaymentsEscrowMilestones1706234567892
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    const ordersTable = await queryRunner.getTable('orders');

    if (ordersTable) {
      if (!ordersTable.findColumnByName('currency')) {
        await queryRunner.addColumn(
          'orders',
          new TableColumn({
            name: 'currency',
            type: 'varchar',
            length: '3',
            isNullable: false,
            default: `'USD'`,
          }),
        );
      }

      if (!ordersTable.findColumnByName('escrow_type')) {
        await queryRunner.addColumn(
          'orders',
          new TableColumn({
            name: 'escrow_type',
            type: 'varchar',
            length: '20',
            isNullable: true,
          }),
        );
      }

      if (!ordersTable.findColumnByName('milestones')) {
        await queryRunner.addColumn(
          'orders',
          new TableColumn({
            name: 'milestones',
            type: 'jsonb',
            isNullable: true,
          }),
        );
      }

      if (!ordersTable.findColumnByName('released_amount')) {
        await queryRunner.addColumn(
          'orders',
          new TableColumn({
            name: 'released_amount',
            type: 'decimal',
            precision: 12,
            scale: 2,
            default: 0,
          }),
        );
      }

      if (!ordersTable.findColumnByName('remaining_amount')) {
        await queryRunner.addColumn(
          'orders',
          new TableColumn({
            name: 'remaining_amount',
            type: 'decimal',
            precision: 12,
            scale: 2,
            default: 0,
          }),
        );
      }

      if (!ordersTable.findColumnByName('deleted_at')) {
        await queryRunner.addColumn(
          'orders',
          new TableColumn({
            name: 'deleted_at',
            type: 'timestamp',
            isNullable: true,
          }),
        );
      }

      if (!ordersTable.findColumnByName('shipping_address')) {
        await queryRunner.addColumn(
          'orders',
          new TableColumn({
            name: 'shipping_address',
            type: 'varchar',
            length: '255',
            isNullable: true,
          }),
        );
      }

      await queryRunner.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_enum
            WHERE enumlabel = 'paid'
              AND enumtypid = 'orders_status_enum'::regtype
          ) THEN
            ALTER TYPE "orders_status_enum" ADD VALUE 'paid';
          END IF;

          IF NOT EXISTS (
            SELECT 1 FROM pg_enum
            WHERE enumlabel = 'manual_review'
              AND enumtypid = 'orders_status_enum'::regtype
          ) THEN
            ALTER TYPE "orders_status_enum" ADD VALUE 'manual_review';
          END IF;
        END$$;
      `);

      const shippingColumn = ordersTable.findColumnByName('shipping_address');
      if (shippingColumn && !shippingColumn.isNullable) {
        await queryRunner.changeColumn(
          'orders',
          shippingColumn,
          new TableColumn({
            name: 'shipping_address',
            type: 'varchar',
            length: '255',
            isNullable: true,
          }),
        );
      }
    }

    await queryRunner.createTable(
      new Table({
        name: 'payments',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'order_id',
            type: 'uuid',
          },
          {
            name: 'amount',
            type: 'decimal',
            precision: 20,
            scale: 7,
          },
          {
            name: 'currency',
            type: 'varchar',
            length: '10',
            isNullable: false,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '20',
            default: `'pending'`,
          },
          {
            name: 'stellar_transaction_id',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'destination_wallet_address',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'source_wallet_address',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'confirmation_count',
            type: 'int',
            default: 0,
          },
          {
            name: 'timeout_minutes',
            type: 'integer',
            default: 30,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'confirmed_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'failed_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'expires_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'failure_reason',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'stellar_transaction_data',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'buyer_id',
            type: 'uuid',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndices('payments', [
      new TableIndex({
        name: 'IDX_PAYMENTS_ORDER_ID',
        columnNames: ['order_id'],
      }),
      new TableIndex({
        name: 'IDX_PAYMENTS_STATUS',
        columnNames: ['status'],
      }),
      new TableIndex({
        name: 'IDX_PAYMENTS_BUYER_ID',
        columnNames: ['buyer_id'],
      }),
    ]);

    await queryRunner.createTable(
      new Table({
        name: 'escrow_transactions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'order_id',
            type: 'uuid',
          },
          {
            name: 'buyer_public_key',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'seller_public_key',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'amount',
            type: 'decimal',
            precision: 20,
            scale: 7,
          },
          {
            name: 'escrow_account_public_key',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'lock_transaction_hash',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'release_transaction_hash',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'refund_transaction_hash',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '50',
            default: `'pending'`,
          },
          {
            name: 'delivery_confirmed_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'cancelled_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'error_message',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'dispute_flag',
            type: 'boolean',
            default: false,
          },
          {
            name: 'released_amount',
            type: 'decimal',
            precision: 20,
            scale: 7,
            default: 0,
          },
          {
            name: 'refunded_amount',
            type: 'decimal',
            precision: 20,
            scale: 7,
            default: 0,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'now()',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndices('escrow_transactions', [
      new TableIndex({
        name: 'IDX_ESCROW_ORDER_ID',
        columnNames: ['order_id'],
      }),
      new TableIndex({
        name: 'IDX_ESCROW_BUYER_KEY',
        columnNames: ['buyer_public_key'],
      }),
      new TableIndex({
        name: 'IDX_ESCROW_SELLER_KEY',
        columnNames: ['seller_public_key'],
      }),
      new TableIndex({
        name: 'IDX_ESCROW_STATUS',
        columnNames: ['status'],
      }),
    ]);

    await queryRunner.createTable(
      new Table({
        name: 'milestones',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'order_id',
            type: 'uuid',
          },
          {
            name: 'title',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'description',
            type: 'text',
          },
          {
            name: 'amount',
            type: 'decimal',
            precision: 20,
            scale: 2,
          },
          {
            name: 'percentage',
            type: 'decimal',
            precision: 5,
            scale: 2,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '50',
            default: `'pending'`,
          },
          {
            name: 'type',
            type: 'varchar',
            length: '50',
            default: `'custom'`,
          },
          {
            name: 'trigger',
            type: 'varchar',
            length: '50',
            default: `'manual'`,
          },
          {
            name: 'auto_release',
            type: 'boolean',
            default: false,
          },
          {
            name: 'release_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'released_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'release_transaction_id',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'required_documents',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'uploaded_documents',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'release_conditions',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'admin_notes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'rejection_reason',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'dispute_details',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'sort_order',
            type: 'int',
            default: 0,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'now()',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndices('milestones', [
      new TableIndex({
        name: 'IDX_MILESTONES_ORDER_ID',
        columnNames: ['order_id'],
      }),
      new TableIndex({
        name: 'IDX_MILESTONES_STATUS',
        columnNames: ['status'],
      }),
      new TableIndex({
        name: 'IDX_MILESTONES_RELEASE_AT',
        columnNames: ['release_at'],
      }),
    ]);

    await queryRunner.createForeignKey(
      'payments',
      new TableForeignKey({
        columnNames: ['order_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'orders',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'escrow_transactions',
      new TableForeignKey({
        columnNames: ['order_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'orders',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'milestones',
      new TableForeignKey({
        columnNames: ['order_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'orders',
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const milestonesTable = await queryRunner.getTable('milestones');
    if (milestonesTable) {
      const foreignKeys = milestonesTable.foreignKeys;
      for (const foreignKey of foreignKeys) {
        await queryRunner.dropForeignKey('milestones', foreignKey);
      }
    }

    const escrowTable = await queryRunner.getTable('escrow_transactions');
    if (escrowTable) {
      const foreignKeys = escrowTable.foreignKeys;
      for (const foreignKey of foreignKeys) {
        await queryRunner.dropForeignKey('escrow_transactions', foreignKey);
      }
    }

    const paymentsTable = await queryRunner.getTable('payments');
    if (paymentsTable) {
      const foreignKeys = paymentsTable.foreignKeys;
      for (const foreignKey of foreignKeys) {
        await queryRunner.dropForeignKey('payments', foreignKey);
      }
    }

    await queryRunner.dropTable('milestones', true);
    await queryRunner.dropTable('escrow_transactions', true);
    await queryRunner.dropTable('payments', true);

    const ordersTable = await queryRunner.getTable('orders');
    if (ordersTable) {
      for (const columnName of [
        'currency',
        'escrow_type',
        'milestones',
        'released_amount',
        'remaining_amount',
        'deleted_at',
        'shipping_address',
      ]) {
        const column = ordersTable.findColumnByName(columnName);
        if (column) {
          await queryRunner.dropColumn('orders', column);
        }
      }
    }
  }
}
