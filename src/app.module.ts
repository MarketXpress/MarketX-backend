import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ListingsModule } from './listing/listing.module';
import { MarketPlaceModule } from './market-place/market-place.module';
import { WalletModule } from './wallet/wallet.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { AdminGuard } from './guards/admin.guard';
import { RolesGuard } from './guards/roles.guard';
import { AuthModule } from './auth/auth.module';
import { FavoritesModule } from './favorites/favorites.module';
import { Listing } from './listing/entities/listing.entity';
import { UsersModule } from './users/users.module';
import { VerificationModule } from './verification/verification.module';
import { ChatModule } from './chat/chat.module';
import { Users } from './users/users.entity';
import { WebhooksModule } from './webhooks/webhooks.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { ReportsModule } from './reports/reports.module';
import { ScheduleModule } from '@nestjs/schedule';
import { CacheModule } from './cache/cache.module';
import { NotificationsModule } from './notifications/notifications.module';
import { TransactionsModule } from './transactions/transactions.module';
import { AuditModule } from './audit/audit.module';
import { DeletedListingsModule } from './deleted-listings/deleted-listings.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
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
        entities: [Listing, Users], // or use: [__dirname + '/**/*.entity{.ts,.js}']
        synchronize: true, // disable in production, use migrations
      }),
      inject: [ConfigService],
    }),
    ScheduleModule.forRoot(),
    ListingsModule,
    MarketPlaceModule,
    WalletModule,
    UsersModule,
    AuthModule,
    FavoritesModule,
    SchedulerModule,
    VerificationModule,
    ChatModule,
    AuthModule,
    UsersModule,
    MarketPlaceModule,
    NotificationsModule,
    FavoritesModule,
    ChatModule,
    TransactionsModule,
    WalletModule,
    VerificationModule,
    AuditModule,
    DeletedListingsModule,
    SchedulerModule,
    CacheModule,
    AuthModule,
    UsersModule,
    WebhooksModule,
    AnalyticsModule,
    ReportsModule,
  ],
  controllers: [AppController],
  providers: [AppService, AdminGuard, RolesGuard],
  exports: [AdminGuard, RolesGuard],
})
export class AppModule {}
