import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WishlistsController } from './wishlists.controller';
import { WishlistsService } from './wishlists.service';
import { Wishlist } from './entities/wishlist.entity';
import { WishlistItem } from './entities/wishlist-item.entity';
import { WishlistPriceScheduler } from './wishlists.scheduler';
import { NotificationsModule } from '../notifications/notifications.module';
import { NotificationsService } from '../notifications/notifications.service';
import { Product } from '../entities/product.entity';
import { ProductsService } from '../products/products.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Wishlist, WishlistItem, Product]),
    NotificationsModule,
  ],
  controllers: [WishlistsController],
  providers: [
    WishlistsService,
    WishlistPriceScheduler,
    NotificationsService,
    ProductsService,
  ],
  exports: [WishlistsService],
})
export class WishlistsModule {}