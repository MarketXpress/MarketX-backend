import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { UserAnalyticsService } from './user-analytics.service';
import { SellerAnalyticsService } from './seller-analytics.service';
import { SellerAnalyticsController } from './seller-analytics.controller';
import { AnalyticsGateway } from './analytics.gateway';
import { Order } from '../entities/order.entity';
import { Product } from '../entities/product.entity';
import { User } from '../entities/user.entity';
import { SellersAnalyticsController } from './sellers-analytics.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Order, Product, User])],
  controllers: [AnalyticsController, SellerAnalyticsController],
  providers: [
    AnalyticsService,
    UserAnalyticsService,
    SellerAnalyticsService,
    AnalyticsGateway,
  ],
  exports: [
    AnalyticsService,
    UserAnalyticsService,
    SellerAnalyticsService,
    AnalyticsGateway,
  ],
  imports: [CacheModule.register({ ttl: 60 })],
  controllers: [AnalyticsController, SellersAnalyticsController],
  providers: [AnalyticsService, UserAnalyticsService, AnalyticsGateway],
  exports: [AnalyticsService, UserAnalyticsService, AnalyticsGateway],
})
export class AnalyticsModule {}