import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { Listing } from './listing/entities/listing.entity';
import { ListingsModule } from './listing/listing.module';
import { MarketPlaceModule } from './market-place/market-place.module';
import { WalletModule } from './wallet/wallet.module';
import { UserModule } from './user/user.module';
import { AdminController } from './controllers/admin.controller';
import { UsersController } from './controllers/users.controller';
import { AdminService } from './services/admin.service';
import { UsersService } from './services/users.service';
import { AdminGuard } from './guards/admin.guard';
import { RolesGuard } from './guards/roles.guard';
import { AuthModule } from './auth/auth.module';
import { FavoritesModule } from './favorites/favorites.module'; 

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
        entities: [Listing], // or use: [__dirname + '/**/*.entity{.ts,.js}']
        synchronize: true, // disable in production, use migrations
      }),
      inject: [ConfigService],
    }),

    ListingsModule,

    MarketPlaceModule,

    WalletModule,

    UserModule,

    AuthModule,

    FavoritesModule
  ],
  controllers: [AppController, AdminController, UsersController],
  providers: [AppService, AdminService, UsersService, AdminGuard, RolesGuard],
  exports: [AdminGuard, RolesGuard],
})
export class AppModule {}
