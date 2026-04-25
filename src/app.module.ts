import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bull';
import { ThrottlerModule } from '@nestjs/throttler';

import { AppController } from './app.controller';
import { AppService } from './app.service';

// ── Infrastructure ─────────────────────────────────────────────────────────
import { CommonModule } from './common/common.module';
import { LoggerModule } from './common/logger/logger.module';
import { HealthModule } from './health/health.module';
import { RedisCacheModule } from './redis-caching/redis-cache.module';
import { BackupModule } from './backup/backup.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { RabbitMqModule } from './messaging/rabbitmq.module';
import { IdempotencyModule } from './common/idempotency/idempotency.module';

// ── Features ───────────────────────────────────────────────────────────────
import { AuthModule } from './auth/auth.module';
import { ProductsModule } from './products/products.module';
import { FraudModule } from './fraud/fraud.module';
import { MessagesModule } from './messages/messages.module';
import { PaymentsModule } from './payments/payments.module';
import { CustomI18nModule } from './i18n/i18n.module';
import { PriceModule } from './price/price.module';
import { VerificationModule } from './verification/verification.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { ShippingModule } from './shipping/shipping.module';
import { MediaModule } from './media/media.module';
import { CouponsModule } from './coupons/coupons.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { WishlistsModule } from './wishlist/wishlists.module';
import { EmailModule } from './email/email.module';
import { FeatureFlagsModule } from './feature-flags/feature-flags.module';
import { JobsModule } from './job-processing/jobs.module';
import { RecommendationsModule } from './recommendation/recommendation.module';
import { RefundsModule } from './refunds/refunds.module';
import { ListingsModule } from './listing/listing.module';
import { SearchModule } from './search/search.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AdminModule } from './admin/admin.module';
import { OrdersModule } from './orders/orders.module';
import { MilestonesModule } from './milestones/milestones.module';
import { ArchivingModule } from './archiving/archiving.module';
import { RewardsModule } from './rewards/rewards.module';
import { CurrencyModule } from './currency/currency.module';


// ── Entities ───────────────────────────────────────────────────────────────
import { ProductImage } from './media/entities/image.entity';
import { Coupon } from './coupons/entities/coupon.entity';
import { CouponUsage } from './coupons/entities/coupon-usage.entity';
import { RewardPoints } from './rewards/entities/reward-points.entity';

// ── Guards & Middleware ─────────────────────────────────────────────────────
import { AdminGuard } from './guards/admin.guard';
import { RolesGuard } from './guards/roles.guard';
import { ThrottleGuard } from './common/guards/throttle.guard';
import { DynamicThrottlerGuard } from './auth/guards/dynamic-throttler.guard';
import { SecurityMiddleware } from './common/middleware/security.middleware';
import { RequestMonitorMiddleware } from './fraud/middleware/request-monitor.middleware';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';

@Module({
  imports: [
    // ── Core config ──────────────────────────────────────────────────────
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),

    /**
     * ── 🔥 GLOBAL THROTTLER (REDIS BACKED)
     */
    ThrottlerModule.forRootAsync({
      useFactory: () => ({
        throttlers: [
          {
            ttl: 60_000,
            limit: 100,
          },
        ],
      }),
    }),

    // ── Database ─────────────────────────────────────────────────────────
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '5432', 10),
      username: process.env.DATABASE_USER,
      password: process.env.DATABASE_PASSWORD,
      database: process.env.DATABASE_NAME,
      autoLoadEntities: true,
      synchronize: process.env.NODE_ENV !== 'production',
      migrations: ['dist/migrations/*.js'],
      migrationsRun: false,
    }),
    TypeOrmModule.forFeature([ProductImage, Coupon, CouponUsage, RewardPoints]),

    // ── Queue ─────────────────────────────────────────────────────────────
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
      },
    }),

    // ── Infrastructure ────────────────────────────────────────────────────
    RedisCacheModule,
    LoggerModule,
    CommonModule,
    HealthModule,
    BackupModule,
    SchedulerModule,
    EventEmitterModule.forRoot(),
    RabbitMqModule,
    IdempotencyModule,

    // ── Features ──────────────────────────────────────────────────────────
    AuthModule,
    PriceModule,
    ProductsModule,
    FraudModule,
    MessagesModule,
    PaymentsModule,
    CustomI18nModule,
    VerificationModule,
    SubscriptionsModule,
    MilestonesModule,
    ShippingModule,
    MediaModule,
    CouponsModule,
    AnalyticsModule,
    WishlistsModule,
    EmailModule,
    FeatureFlagsModule,
    JobsModule,
    RecommendationsModule,
    RefundsModule,
    ListingsModule,
    SearchModule,
    NotificationsModule,
    AdminModule,
    OrdersModule,
    ArchivingModule,
    RewardsModule,
    CurrencyModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    AdminGuard,
    RolesGuard,
    DynamicThrottlerGuard,

    /**
     * ── GLOBAL RATE LIMIT GUARD
     */
    {
      provide: APP_GUARD,
      useClass: ThrottleGuard,
    },
  ],
  exports: [AdminGuard, RolesGuard, LoggerModule],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(CorrelationIdMiddleware, SecurityMiddleware, RequestMonitorMiddleware)
      .forRoutes('*');
  }
}
