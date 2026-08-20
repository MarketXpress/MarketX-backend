import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import { BullModule } from '@nestjs/bull';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CategoriesModule } from './categories/categories.module';
import { ProductsModule } from './products/products.module';
import { OrdersModule } from './orders/orders.module';
import { HealthModule } from './health/health.module';
import { CommonModule } from './common/common.module';
import { LoggerModule } from './common/logger/logger.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AdminModule } from './admin/admin.module';
import { EscrowModule } from './escrow/escrow.module';
import { AdminGuard } from './guards/admin.guard';
import { RolesGuard } from './guards/roles.guard';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';
import { SecurityMiddleware } from './common/middleware/security.middleware';
import { ReviewModule } from './review/review.module';
import { ConfigValidationModule } from './common/config/config-validation.module';
import { validateEnvironment } from './common/config/config-validation.rules';

// Entities
import { Product } from './products/entities/product.entity';
import { ProductPriceEntity } from './products/entities/product-price.entity';

@Module({
  imports: [
    // Environment configuration and validation.
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironment,
    }),

    ConfigValidationModule,

    // Global rate limiting.
    ThrottlerModule.forRootAsync({
      useFactory: () => ({
        throttlers: [
          {
            ttl: parseInt(process.env.THROTTLE_TTL || '60000', 10),
            limit: parseInt(process.env.THROTTLE_LIMIT || '100', 10),
          },
        ],
      }),
    }),

    // PostgreSQL / TypeORM.
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '5432', 10),
      username: process.env.DATABASE_USER,
      password: process.env.DATABASE_PASSWORD,
      database: process.env.DATABASE_NAME,
      autoLoadEntities: true,
      entities: [Product, ProductPriceEntity],
      synchronize: process.env.NODE_ENV !== 'production',
      logging: process.env.DB_LOGGING === 'true',
    }),

    // Bull queues use Redis as a hard dependency because webhook/payment
    // processing depends on the queue being available.
    BullModule.forRootAsync({
      useFactory: () => ({
        redis: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379', 10),
          password: process.env.REDIS_PASSWORD || undefined,
          db: parseInt(process.env.REDIS_DB || '0', 10),
        },
      }),
    }),

    // Application cache.
    //
    // Redis is intentionally shared with the same connection configuration
    // used by Bull, while retaining a separate Redis database for cache data.
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: async () => {
        const store = await redisStore({
          socket: {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379', 10),
          },
          password: process.env.REDIS_PASSWORD || undefined,
          database: parseInt(process.env.REDIS_CACHE_DB || '10', 10),
        });

        return {
          store,
          ttl: 60,
        };
      },
    }),

    // Prometheus metrics.
    //
    // The module exposes the Prometheus registry used by the /metrics
    // controller. Access control is applied by MetricsController rather
    // than exposing the endpoint anonymously.
    PrometheusModule.register({
      path: 'metrics',
    }),

    LoggerModule,
    CommonModule,
    HealthModule,

    AuthModule,
    UsersModule,
    CategoriesModule,
    ProductsModule,
    OrdersModule,
    WebhooksModule,
    NotificationsModule,
    AdminModule,
    ReviewModule,
    EscrowModule,
  ],

  controllers: [AppController],

  providers: [
    AppService,
    AdminGuard,
    RolesGuard,
    HttpExceptionFilter,

    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },

    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],

  exports: [AdminGuard, RolesGuard, LoggerModule],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware, SecurityMiddleware).forRoutes('*');
  }
}
