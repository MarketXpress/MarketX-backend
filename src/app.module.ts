import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bull';

import { AppController } from './app.controller';
import { AppService } from './app.service';

// ── Infrastructure ─────────────────────────────────────────────────────────
import { CommonModule } from './common/common.module';
import { LoggerModule } from './common/logger/logger.module';
import { HealthModule } from './health/health.module';
import { RedisCacheModule } from './redis-caching/redis-cache.module';
import { BackupModule } from './backup/backup.module';

// ── Features ───────────────────────────────────────────────────────────────
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

// ── Entities registered at root (shared / no dedicated module) ─────────────
import { ProductImage } from './media/entities/image.entity';
import { Coupon } from './coupons/entities/coupon.entity';
import { CouponUsage } from './coupons/entities/coupon-usage.entity';

// ── Guards & Middleware ─────────────────────────────────────────────────────
import { AdminGuard } from './guards/admin.guard';
import { RolesGuard } from './guards/roles.guard';
import { ThrottleGuard } from './common/guards/throttle.guard';
import { SecurityMiddleware } from './common/middleware/security.middleware';
import { RequestMonitorMiddleware } from './fraud/middleware/request-monitor.middleware';

@Module({
  imports: [
    // ── Core config ──────────────────────────────────────────────────────
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),

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
    TypeOrmModule.forFeature([ProductImage, Coupon, CouponUsage]),

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

    // ── Features ──────────────────────────────────────────────────────────
    PriceModule,
    ProductsModule,
    FraudModule,
    MessagesModule,
    PaymentsModule,
    CustomI18nModule,
    VerificationModule,
    SubscriptionsModule,
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
  ],
  controllers: [AppController],
  providers: [
    AppService,
    AdminGuard,
    RolesGuard,
    {
      provide: APP_GUARD,
      useClass: ThrottleGuard,
    },
  ],
  exports: [AdminGuard, RolesGuard, LoggerModule],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(SecurityMiddleware, RequestMonitorMiddleware).forRoutes('*');
  }
}
