import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateUserFavoritesTable1678901234567
  implements MigrationInterface
{
  name = 'CreateUserFavoritesTable1678901234567';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'user_favorites',
        columns: [
          {
            name: 'user_id',
            type: 'int',
            isPrimary: true,
          },
          {
            name: 'listing_id',
            type: 'uuid', // 👈 Update this if listings.id is uuid
            isPrimary: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'user_favorites',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'user_favorites',
      new TableForeignKey({
        columnNames: ['listing_id'],
        referencedTableName: 'listings',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createIndex(
      'user_favorites',
      new TableIndex({
        name: 'IDX_USER_FAVORITES_USER_ID',
        columnNames: ['user_id'],
      }),
    );

    await queryRunner.createIndex(
      'user_favorites',
      new TableIndex({
        name: 'IDX_USER_FAVORITES_LISTING_ID',
        columnNames: ['listing_id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Safely get the table
    const table = await queryRunner.getTable('user_favorites');
    if (table) {
      const foreignKeys = table.foreignKeys.filter((fk) =>
        ['user_id', 'listing_id'].includes(fk.columnNames[0]),
      );
      for (const fk of foreignKeys) {
        await queryRunner.dropForeignKey('user_favorites', fk);
      }
    }

    await queryRunner.dropIndex('user_favorites', 'IDX_USER_FAVORITES_USER_ID');
    await queryRunner.dropIndex(
      'user_favorites',
      'IDX_USER_FAVORITES_LISTING_ID',
    );
    await queryRunner.dropTable('user_favorites');
  }
}
