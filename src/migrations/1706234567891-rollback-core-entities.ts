import { MigrationInterface, QueryRunner } from "typeorm";

export class RollbackCoreEntities1706234567891 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // This is the rollback migration - it does the opposite of the create migration
        console.log('Rolling back core entities migration...');
        
        // Drop foreign key constraints first
        const tableNames = ['transactions', 'orders', 'products'];
        for (const tableName of tableNames) {
            try {
                const table = await queryRunner.getTable(tableName);
                if (table) {
                    const foreignKeys = table.foreignKeys;
                    for (const foreignKey of foreignKeys) {
                        await queryRunner.dropForeignKey(tableName, foreignKey);
                    }
                }
            } catch (error) {
                console.log(`Foreign key constraint not found for ${tableName}:`, error.message);
            }
        }

        // Drop tables in reverse order
        const tablesToDrop = ['transactions', 'orders', 'products', 'users'];
        for (const tableName of tablesToDrop) {
            try {
                await queryRunner.dropTable(tableName, true);
                console.log(`Dropped table ${tableName}`);
            } catch (error) {
                console.log(`Table ${tableName} not found or already dropped:`, error.message);
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // This would recreate the tables if we roll forward again
        // But typically we'd use the original create migration for that
        console.log('Re-applying core entities migration...');
        // In practice, you would re-run the original migration
    }
}