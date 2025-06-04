import { MigrationInterface, QueryRunner, Table, Index } from 'typeorm';

export class CreateUserFavoritesTable1678901234567 implements MigrationInterface {
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
            type: 'int',
            isPrimary: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
        foreignKeys: [
          {
            columnNames: ['user_id'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            columnNames: ['listing_id'],
            referencedTableName: 'listings',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true,
    );

    // Create indexes for better performance
    await queryRunner.createIndex(
      'user_favorites',
      new Index('IDX_USER_FAVORITES_USER_ID', ['user_id']),
    );

    await queryRunner.createIndex(
      'user_favorites',
      new Index('IDX_USER_FAVORITES_LISTING_ID', ['listing_id']),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('user_favorites');
  }
}