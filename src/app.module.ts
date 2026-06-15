import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CategoriesModule } from './categories/categories.module';
import { ProductsModule } from './products/products.module';
import { OrdersModule } from './orders/orders.module';
import { HealthModule } from './health/health.module';
import { CommonModule } from './common/common.module';
import { LoggerModule } from './common/logger/logger.module';

import { AdminGuard } from './guards/admin.guard';
import { RolesGuard } from './guards/roles.guard';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';
import { SecurityMiddleware } from './common/middleware/security.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    ThrottlerModule.forRootAsync({
      useFactory: () => ({
        throttlers: [{ ttl: 60_000, limit: 100 }],
      }),
    }),

    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '5432', 10),
      username: process.env.DATABASE_USER,
      password: process.env.DATABASE_PASSWORD,
      database: process.env.DATABASE_NAME,
      autoLoadEntities: true,
      synchronize: process.env.NODE_ENV !== 'production',
      logging: process.env.DB_LOGGING === 'true',
    }),

    LoggerModule,
    CommonModule,
    HealthModule,

    AuthModule,
    UsersModule,
    CategoriesModule,
    ProductsModule,
    OrdersModule,
  ],
  controllers: [AppController],
  providers: [AppService, AdminGuard, RolesGuard],
  exports: [AdminGuard, RolesGuard, LoggerModule],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(CorrelationIdMiddleware, SecurityMiddleware)
      .forRoutes('*');
  }
}
