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
    ListingsModule,
    MarketPlaceModule,
    WalletModule,
    UsersModule,
    AuthModule,
    FavoritesModule,
    SchedulerModule,
    VerificationModule,
    ChatModule,
    WebhooksModule,
  ],
  controllers: [AppController],
  providers: [AppService, AdminGuard, RolesGuard],
  exports: [AdminGuard, RolesGuard],
})
export class AppModule {}
