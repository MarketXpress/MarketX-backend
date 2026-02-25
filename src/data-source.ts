import { DataSource } from 'typeorm';
import { User } from './entities/user.entity';
import { Product } from './entities/product.entity';
import { Order } from './entities/order.entity';
import { Transaction } from './entities/transaction.entity';
import { FraudAlert } from './fraud/entities/fraud-alert.entity';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432', 10),
  username: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  synchronize: false,
  logging: false,
  entities: [User, Product, Order, Transaction, FraudAlert],
  migrations: ['src/migrations/*.ts'],
  subscribers: [],
});
