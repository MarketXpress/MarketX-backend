import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AdminGuard } from './guards/admin.guard';
import { RolesGuard } from './guards/roles.guard';
import { Listing } from './listing/entities/listing.entity';
import { Users } from './users/users.entity';

// Application Modules
import { ListingsModule } from './listing/listing.module';
import { MarketPlaceModule } from './market-place/market-place.module';
import { WalletModule } from './wallet/wallet.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { AuthModule } from './auth/auth.module';
import { FavoritesModule } from './favorites/favorites.module';
import { UsersModule } from './users/users.module';
import { VerificationModule } from './verification/verification.module';
import { ChatModule } from './chat/chat.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { CustomI18nModule } from './i18n/i18n.module';
import { RateLimitingModule } from './rate-limiting/rate-limiting.module';
import { AdminModule } from './admin/admin.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { ReportsModule } from './reports/reports.module';
import { CacheModule } from './cache/cache.module';
import { NotificationsModule } from './notifications/notifications.module';
import { TransactionsModule } from './transactions/transactions.module';
import { AuditModule } from './audit/audit.module';
import { DeletedListingsModule } from './deleted-listings/deleted-listings.module';
import { EscrowModule } from './escrow/escrow.module';

@Module({
  imports: [
    // Configuration and Core Modules
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true, // Enable configuration caching
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_NAME'),
        entities: [Listing, Users, __dirname + '/**/*.entity{.ts,.js}'],
        synchronize: configService.get<string>('NODE_ENV') !== 'production',
        logging: configService.get<string>('NODE_ENV') === 'development',
        extra: {
          connectionLimit: configService.get<number>('DB_POOL_SIZE', 10),
        },
      }),
      inject: [ConfigService],
    }),
    ScheduleModule.forRoot(),

    // Feature Modules (ordered by dependency)
    AuthModule,
    UsersModule,
    AuditModule,
    RateLimitingModule,
    CacheModule,

    // Business Modules
    TransactionsModule,
    EscrowModule, // Added after TransactionsModule due to dependency
    WalletModule,
    ListingsModule,
    MarketPlaceModule,
    VerificationModule,

    // Supporting Modules
    NotificationsModule,
    FavoritesModule,
    ChatModule,
    WebhooksModule,
    CustomI18nModule,
    AdminModule,
    AnalyticsModule,
    ReportsModule,
    SchedulerModule,
    DeletedListingsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    AdminGuard,
    RolesGuard,
  ],
  exports: [AdminGuard, RolesGuard],
})
export class AppModule {}
