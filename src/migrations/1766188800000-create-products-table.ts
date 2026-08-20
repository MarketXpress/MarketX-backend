import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateProductsTable1766188800000 implements MigrationInterface {
  name = 'CreateProductsTable1766188800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasProductsTable = await queryRunner.hasTable('products');

    if (!hasProductsTable) {
      await queryRunner.createTable(
        new Table({
          name: 'products',
          columns: [
            {
              name: 'id',
              type: 'uuid',
              isPrimary: true,
              default: 'gen_random_uuid()',
            },
            {
              name: 'sellerId',
              type: 'uuid',
            },
            {
              name: 'name',
              type: 'varchar',
              length: '255',
            },
            {
              name: 'category',
              type: 'varchar',
              length: '100',
            },
            {
              name: 'basePrice',
              type: 'numeric',
              precision: 20,
              scale: 7,
            },
            {
              name: 'basePriceMinor',
              type: 'numeric',
              precision: 40,
              scale: 0,
            },
            {
              name: 'baseCurrency',
              type: 'varchar',
            },
            {
              name: 'price',
              type: 'numeric',
              precision: 20,
              scale: 7,
            },
            {
              name: 'priceMinor',
              type: 'numeric',
              precision: 40,
              scale: 0,
            },
            {
              name: 'currency',
              type: 'varchar',
            },
            {
              name: 'description',
              type: 'text',
              isNullable: true,
            },
            {
              name: 'images',
              type: 'json',
              default: "'[]'",
            },
            {
              name: 'createdAt',
              type: 'timestamptz',
              default: 'now()',
            },
            {
              name: 'updatedAt',
              type: 'timestamptz',
              default: 'now()',
            },
          ],
        }),
        true,
      );
    }

    await queryRunner.createIndex(
      'products',
      new TableIndex({
        name: 'IDX_products_seller_id',
        columnNames: ['sellerId'],
      }),
    );

    await queryRunner.createIndex(
      'products',
      new TableIndex({
        name: 'IDX_products_category',
        columnNames: ['category'],
      }),
    );

    await queryRunner.createIndex(
      'products',
      new TableIndex({
        name: 'IDX_products_created_at',
        columnNames: ['createdAt'],
      }),
    );

    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_products_name_trgm"
      ON "products"
      USING gin ("name" gin_trgm_ops)
    `);

    const productPricesTable = await queryRunner.hasTable('product_prices');

    if (
      productPricesTable &&
      !(await this.hasForeignKey(queryRunner, 'product_prices', 'productId'))
    ) {
      await queryRunner.createForeignKey(
        'product_prices',
        new TableForeignKey({
          name: 'FK_product_prices_product',
          columnNames: ['productId'],
          referencedTableName: 'products',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const productPricesTable = await queryRunner.hasTable('product_prices');

    if (productPricesTable) {
      const table = await queryRunner.getTable('product_prices');
      const foreignKey = table?.foreignKeys.find(
        (key) => key.name === 'FK_product_prices_product',
      );

      if (foreignKey) {
        await queryRunner.dropForeignKey('product_prices', foreignKey);
      }
    }

    const productsTable = await queryRunner.hasTable('products');

    if (productsTable) {
      await queryRunner.dropIndex('products', 'IDX_products_name_trgm');
      await queryRunner.dropTable('products', true);
    }
  }

  private async hasForeignKey(
    queryRunner: QueryRunner,
    tableName: string,
    columnName: string,
  ): Promise<boolean> {
    const table = await queryRunner.getTable(tableName);
    if (!table) return false;

    return table.foreignKeys.some(
      (foreignKey) =>
        foreignKey.columnNames.length === 1 &&
        foreignKey.columnNames[0] === columnName &&
        foreignKey.referencedTableName === 'products',
    );
  }
}
