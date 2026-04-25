import { MigrationInterface, QueryRunner } from 'typeorm';

export class StandardizePricesToUSD1700000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add comment to product_prices table documenting USD as base currency
    await queryRunner.query(`
      COMMENT ON TABLE product_prices IS 'All prices stored in USD as base currency';
    `);

    // Add comment to basePrice column
    await queryRunner.query(`
      COMMENT ON COLUMN product_prices."basePrice" IS 'Price in USD (source of truth)';
    `);

    // Update baseCurrency default to USD if not already set
    await queryRunner.query(`
      UPDATE product_prices 
      SET "baseCurrency" = 'USD' 
      WHERE "baseCurrency" IS NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove comments
    await queryRunner.query(`
      COMMENT ON TABLE product_prices IS NULL;
    `);
    
    await queryRunner.query(`
      COMMENT ON COLUMN product_prices."basePrice" IS NULL;
    `);
  }
}
