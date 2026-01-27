import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from "typeorm";

export class CreateCoreEntities1706234567890 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create Users table
        await queryRunner.createTable(new Table({
            name: 'users',
            columns: [
                {
                    name: 'id',
                    type: 'uuid',
                    isPrimary: true,
                    isGenerated: true,
                    generationStrategy: 'uuid'
                },
                {
                    name: 'email',
                    type: 'varchar',
                    length: '255',
                    isUnique: true
                },
                {
                    name: 'password',
                    type: 'varchar',
                    length: '255'
                },
                {
                    name: 'first_name',
                    type: 'varchar',
                    length: '100'
                },
                {
                    name: 'last_name',
                    type: 'varchar',
                    length: '100'
                },
                {
                    name: 'phone_number',
                    type: 'varchar',
                    length: '20',
                    isNullable: true
                },
                {
                    name: 'bio',
                    type: 'varchar',
                    length: '500',
                    isNullable: true
                },
                {
                    name: 'avatar_url',
                    type: 'varchar',
                    length: '500',
                    isNullable: true
                },
                {
                    name: 'stellar_wallet_address',
                    type: 'varchar',
                    length: '56',
                    isNullable: true,
                    isUnique: true
                },
                {
                    name: 'role',
                    type: 'enum',
                    enum: ['buyer', 'seller', 'admin', 'moderator'],
                    default: `'buyer'`
                },
                {
                    name: 'status',
                    type: 'enum',
                    enum: ['active', 'inactive', 'suspended', 'deleted'],
                    default: `'active'`
                },
                {
                    name: 'is_active',
                    type: 'boolean',
                    default: true
                },
                {
                    name: 'refresh_token',
                    type: 'text',
                    isNullable: true
                },
                {
                    name: 'language',
                    type: 'varchar',
                    length: '10',
                    isNullable: true,
                    default: `'en'`
                },
                {
                    name: 'seller_rating',
                    type: 'decimal',
                    precision: 3,
                    scale: 2,
                    default: 0
                },
                {
                    name: 'total_reviews',
                    type: 'int',
                    default: 0
                },
                {
                    name: 'total_sales',
                    type: 'int',
                    default: 0
                },
                {
                    name: 'is_verified_seller',
                    type: 'boolean',
                    default: false
                },
                {
                    name: 'is_email_verified',
                    type: 'boolean',
                    default: false
                },
                {
                    name: 'is_phone_verified',
                    type: 'boolean',
                    default: false
                },
                {
                    name: 'last_login_at',
                    type: 'timestamp',
                    isNullable: true
                },
                {
                    name: 'last_login_ip',
                    type: 'varchar',
                    length: '45',
                    isNullable: true
                },
                {
                    name: 'created_at',
                    type: 'timestamp',
                    default: 'now()'
                },
                {
                    name: 'updated_at',
                    type: 'timestamp',
                    default: 'now()'
                },
                {
                    name: 'deleted_at',
                    type: 'timestamp',
                    isNullable: true
                }
            ]
        }), true);

        // Create indexes for users table
        await queryRunner.createIndices('users', [
            new TableIndex({
                name: 'IDX_USERS_EMAIL',
                columnNames: ['email']
            }),
            new TableIndex({
                name: 'IDX_USERS_CREATED_AT',
                columnNames: ['created_at']
            }),
            new TableIndex({
                name: 'IDX_USERS_STATUS',
                columnNames: ['status']
            }),
            new TableIndex({
                name: 'IDX_USERS_ROLE',
                columnNames: ['role']
            })
        ]);

        // Create Products table
        await queryRunner.createTable(new Table({
            name: 'products',
            columns: [
                {
                    name: 'id',
                    type: 'uuid',
                    isPrimary: true,
                    isGenerated: true,
                    generationStrategy: 'uuid'
                },
                {
                    name: 'title',
                    type: 'varchar',
                    length: '255'
                },
                {
                    name: 'description',
                    type: 'text'
                },
                {
                    name: 'price',
                    type: 'decimal',
                    precision: 12,
                    scale: 2
                },
                {
                    name: 'currency',
                    type: 'varchar',
                    length: '3',
                    default: `'USD'`
                },
                {
                    name: 'address',
                    type: 'varchar',
                    length: '255'
                },
                {
                    name: 'category_id',
                    type: 'int',
                    isNullable: true
                },
                {
                    name: 'status',
                    type: 'enum',
                    enum: ['draft', 'active', 'inactive', 'sold_out', 'archived'],
                    default: `'draft'`
                },
                {
                    name: 'condition',
                    type: 'enum',
                    enum: ['new', 'like_new', 'good', 'fair', 'poor'],
                    default: `'new'`
                },
                {
                    name: 'quantity',
                    type: 'int',
                    default: 1
                },
                {
                    name: 'reserved',
                    type: 'int',
                    default: 0
                },
                {
                    name: 'available',
                    type: 'int',
                    default: 1
                },
                {
                    name: 'images',
                    type: 'text',
                    isNullable: true
                },
                {
                    name: 'tags',
                    type: 'text',
                    isNullable: true
                },
                {
                    name: 'is_active',
                    type: 'boolean',
                    default: true
                },
                {
                    name: 'is_featured',
                    type: 'boolean',
                    default: false
                },
                {
                    name: 'is_digital',
                    type: 'boolean',
                    default: false
                },
                {
                    name: 'views',
                    type: 'int',
                    default: 0
                },
                {
                    name: 'favorites_count',
                    type: 'int',
                    default: 0
                },
                {
                    name: 'average_rating',
                    type: 'decimal',
                    precision: 3,
                    scale: 2,
                    default: 0
                },
                {
                    name: 'total_reviews',
                    type: 'int',
                    default: 0
                },
                {
                    name: 'brand',
                    type: 'varchar',
                    length: '255',
                    isNullable: true
                },
                {
                    name: 'model',
                    type: 'varchar',
                    length: '255',
                    isNullable: true
                },
                {
                    name: 'expires_at',
                    type: 'timestamp',
                    isNullable: true
                },
                {
                    name: 'location',
                    type: 'geography',
                    spatialFeatureType: 'Point',
                    srid: 4326,
                    isNullable: true
                },
                {
                    name: 'share_location',
                    type: 'boolean',
                    default: true
                },
                {
                    name: 'user_id',
                    type: 'uuid'
                },
                {
                    name: 'created_at',
                    type: 'timestamp',
                    default: 'now()'
                },
                {
                    name: 'updated_at',
                    type: 'timestamp',
                    default: 'now()'
                },
                {
                    name: 'deleted_at',
                    type: 'timestamp',
                    isNullable: true
                }
            ]
        }), true);

        // Create indexes for products table
        await queryRunner.createIndices('products', [
            new TableIndex({
                name: 'IDX_PRODUCTS_TITLE',
                columnNames: ['title']
            }),
            new TableIndex({
                name: 'IDX_PRODUCTS_PRICE',
                columnNames: ['price']
            }),
            new TableIndex({
                name: 'IDX_PRODUCTS_USER_ID',
                columnNames: ['user_id']
            }),
            new TableIndex({
                name: 'IDX_PRODUCTS_CATEGORY_ID',
                columnNames: ['category_id']
            }),
            new TableIndex({
                name: 'IDX_PRODUCTS_STATUS',
                columnNames: ['status']
            }),
            new TableIndex({
                name: 'IDX_PRODUCTS_QUANTITY',
                columnNames: ['quantity']
            }),
            new TableIndex({
                name: 'IDX_PRODUCTS_AVAILABLE',
                columnNames: ['available']
            }),
            new TableIndex({
                name: 'IDX_PRODUCTS_VIEWS',
                columnNames: ['views']
            }),
            new TableIndex({
                name: 'IDX_PRODUCTS_FAVORITES_COUNT',
                columnNames: ['favorites_count']
            }),
            new TableIndex({
                name: 'IDX_PRODUCTS_AVERAGE_RATING',
                columnNames: ['average_rating']
            }),
            new TableIndex({
                name: 'IDX_PRODUCTS_TOTAL_REVIEWS',
                columnNames: ['total_reviews']
            }),
            new TableIndex({
                name: 'IDX_PRODUCTS_CREATED_AT',
                columnNames: ['created_at']
            }),
            new TableIndex({
                name: 'IDX_PRODUCTS_LOCATION',
                columnNames: ['location'],
                isSpatial: true
            })
        ]);

        // Create Orders table
        await queryRunner.createTable(new Table({
            name: 'orders',
            columns: [
                {
                    name: 'id',
                    type: 'uuid',
                    isPrimary: true,
                    isGenerated: true,
                    generationStrategy: 'uuid'
                },
                {
                    name: 'total_amount',
                    type: 'decimal',
                    precision: 12,
                    scale: 2
                },
                {
                    name: 'tax_amount',
                    type: 'decimal',
                    precision: 12,
                    scale: 2,
                    default: 0
                },
                {
                    name: 'shipping_cost',
                    type: 'decimal',
                    precision: 12,
                    scale: 2,
                    default: 0
                },
                {
                    name: 'discount_amount',
                    type: 'decimal',
                    precision: 12,
                    scale: 2,
                    default: 0
                },
                {
                    name: 'status',
                    type: 'enum',
                    enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'completed', 'cancelled', 'refunded'],
                    default: `'pending'`
                },
                {
                    name: 'payment_status',
                    type: 'enum',
                    enum: ['unpaid', 'paid', 'partially_paid', 'refunded', 'failed'],
                    default: `'unpaid'`
                },
                {
                    name: 'items',
                    type: 'jsonb'
                },
                {
                    name: 'shipping_address',
                    type: 'varchar',
                    length: '255'
                },
                {
                    name: 'tracking_number',
                    type: 'varchar',
                    length: '100',
                    isNullable: true
                },
                {
                    name: 'notes',
                    type: 'varchar',
                    length: '500',
                    isNullable: true
                },
                {
                    name: 'cancellation_reason',
                    type: 'varchar',
                    length: '500',
                    isNullable: true
                },
                {
                    name: 'expected_delivery_date',
                    type: 'timestamp',
                    isNullable: true
                },
                {
                    name: 'buyer_id',
                    type: 'uuid'
                },
                {
                    name: 'seller_id',
                    type: 'uuid',
                    isNullable: true
                },
                {
                    name: 'created_at',
                    type: 'timestamp',
                    default: 'now()'
                },
                {
                    name: 'updated_at',
                    type: 'timestamp',
                    default: 'now()'
                },
                {
                    name: 'confirmed_at',
                    type: 'timestamp',
                    isNullable: true
                },
                {
                    name: 'shipped_at',
                    type: 'timestamp',
                    isNullable: true
                },
                {
                    name: 'delivered_at',
                    type: 'timestamp',
                    isNullable: true
                },
                {
                    name: 'completed_at',
                    type: 'timestamp',
                    isNullable: true
                },
                {
                    name: 'cancelled_at',
                    type: 'timestamp',
                    isNullable: true
                },
                {
                    name: 'refunded_at',
                    type: 'timestamp',
                    isNullable: true
                }
            ]
        }), true);

        // Create indexes for orders table
        await queryRunner.createIndices('orders', [
            new TableIndex({
                name: 'IDX_ORDERS_TOTAL_AMOUNT',
                columnNames: ['total_amount']
            }),
            new TableIndex({
                name: 'IDX_ORDERS_BUYER_ID',
                columnNames: ['buyer_id']
            }),
            new TableIndex({
                name: 'IDX_ORDERS_SELLER_ID',
                columnNames: ['seller_id']
            }),
            new TableIndex({
                name: 'IDX_ORDERS_STATUS',
                columnNames: ['status']
            }),
            new TableIndex({
                name: 'IDX_ORDERS_PAYMENT_STATUS',
                columnNames: ['payment_status']
            }),
            new TableIndex({
                name: 'IDX_ORDERS_CREATED_AT',
                columnNames: ['created_at']
            })
        ]);

        // Create Transactions table
        await queryRunner.createTable(new Table({
            name: 'transactions',
            columns: [
                {
                    name: 'id',
                    type: 'uuid',
                    isPrimary: true,
                    isGenerated: true,
                    generationStrategy: 'uuid'
                },
                {
                    name: 'amount',
                    type: 'decimal',
                    precision: 15,
                    scale: 7
                },
                {
                    name: 'currency',
                    type: 'varchar',
                    length: '3',
                    default: `'USD'`
                },
                {
                    name: 'description',
                    type: 'text',
                    isNullable: true
                },
                {
                    name: 'status',
                    type: 'enum',
                    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled', 'reversed'],
                    default: `'pending'`
                },
                {
                    name: 'type',
                    type: 'enum',
                    enum: ['transfer', 'payment', 'refund', 'purchase', 'withdrawal', 'deposit', 'fee'],
                    default: `'transfer'`
                },
                {
                    name: 'payment_method',
                    type: 'enum',
                    enum: ['stellar', 'credit_card', 'bank_transfer', 'wallet'],
                    default: `'stellar'`
                },
                {
                    name: 'sender_id',
                    type: 'uuid'
                },
                {
                    name: 'receiver_id',
                    type: 'uuid'
                },
                {
                    name: 'order_id',
                    type: 'uuid',
                    isNullable: true
                },
                {
                    name: 'metadata',
                    type: 'jsonb',
                    isNullable: true
                },
                {
                    name: 'reference_id',
                    type: 'varchar',
                    length: '100',
                    isNullable: true
                },
                {
                    name: 'external_reference',
                    type: 'varchar',
                    length: '64',
                    isNullable: true
                },
                {
                    name: 'stellar_hash',
                    type: 'varchar',
                    length: '64',
                    isNullable: true
                },
                {
                    name: 'fee_amount',
                    type: 'decimal',
                    precision: 10,
                    scale: 7,
                    default: 0
                },
                {
                    name: 'fee_currency',
                    type: 'varchar',
                    length: '3',
                    default: `'USD'`
                },
                {
                    name: 'failure_reason',
                    type: 'varchar',
                    length: '500',
                    isNullable: true
                },
                {
                    name: 'created_at',
                    type: 'timestamp',
                    default: 'now()'
                },
                {
                    name: 'updated_at',
                    type: 'timestamp',
                    default: 'now()'
                },
                {
                    name: 'processed_at',
                    type: 'timestamp',
                    isNullable: true
                },
                {
                    name: 'completed_at',
                    type: 'timestamp',
                    isNullable: true
                },
                {
                    name: 'failed_at',
                    type: 'timestamp',
                    isNullable: true
                },
                {
                    name: 'reversed_at',
                    type: 'timestamp',
                    isNullable: true
                }
            ]
        }), true);

        // Create indexes for transactions table
        await queryRunner.createIndices('transactions', [
            new TableIndex({
                name: 'IDX_TRANSACTIONS_AMOUNT',
                columnNames: ['amount']
            }),
            new TableIndex({
                name: 'IDX_TRANSACTIONS_SENDER_ID',
                columnNames: ['sender_id']
            }),
            new TableIndex({
                name: 'IDX_TRANSACTIONS_RECEIVER_ID',
                columnNames: ['receiver_id']
            }),
            new TableIndex({
                name: 'IDX_TRANSACTIONS_ORDER_ID',
                columnNames: ['order_id']
            }),
            new TableIndex({
                name: 'IDX_TRANSACTIONS_STATUS',
                columnNames: ['status']
            }),
            new TableIndex({
                name: 'IDX_TRANSACTIONS_TYPE',
                columnNames: ['type']
            }),
            new TableIndex({
                name: 'IDX_TRANSACTIONS_CREATED_AT',
                columnNames: ['created_at']
            })
        ]);

        // Create Foreign Key Constraints
        // Products -> Users
        await queryRunner.createForeignKey('products', new TableForeignKey({
            columnNames: ['user_id'],
            referencedColumnNames: ['id'],
            referencedTableName: 'users',
            onDelete: 'CASCADE'
        }));

        // Products -> Categories
        await queryRunner.createForeignKey('products', new TableForeignKey({
            columnNames: ['category_id'],
            referencedColumnNames: ['id'],
            referencedTableName: 'categories',
            onDelete: 'SET NULL'
        }));

        // Orders -> Users (buyer)
        await queryRunner.createForeignKey('orders', new TableForeignKey({
            columnNames: ['buyer_id'],
            referencedColumnNames: ['id'],
            referencedTableName: 'users',
            onDelete: 'RESTRICT'
        }));

        // Orders -> Users (seller)
        await queryRunner.createForeignKey('orders', new TableForeignKey({
            columnNames: ['seller_id'],
            referencedColumnNames: ['id'],
            referencedTableName: 'users',
            onDelete: 'SET NULL'
        }));

        // Transactions -> Users (sender)
        await queryRunner.createForeignKey('transactions', new TableForeignKey({
            columnNames: ['sender_id'],
            referencedColumnNames: ['id'],
            referencedTableName: 'users',
            onDelete: 'RESTRICT'
        }));

        // Transactions -> Users (receiver)
        await queryRunner.createForeignKey('transactions', new TableForeignKey({
            columnNames: ['receiver_id'],
            referencedColumnNames: ['id'],
            referencedTableName: 'users',
            onDelete: 'RESTRICT'
        }));

        // Transactions -> Orders
        await queryRunner.createForeignKey('transactions', new TableForeignKey({
            columnNames: ['order_id'],
            referencedColumnNames: ['id'],
            referencedTableName: 'orders',
            onDelete: 'SET NULL'
        }));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop foreign key constraints first
        const tableNames = ['transactions', 'orders', 'products'];
        for (const tableName of tableNames) {
            const table = await queryRunner.getTable(tableName);
            if (table) {
                const foreignKeys = table.foreignKeys;
                for (const foreignKey of foreignKeys) {
                    await queryRunner.dropForeignKey(tableName, foreignKey);
                }
            }
        }

        // Drop tables
        await queryRunner.dropTable('transactions');
        await queryRunner.dropTable('orders');
        await queryRunner.dropTable('products');
        await queryRunner.dropTable('users');
    }
}