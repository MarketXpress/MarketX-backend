import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WishlistsController } from './wishlists.controller';
import { WishlistsService } from './wishlists.service';
import { Wishlist } from './entities/wishlist.entity';
import { WishlistItem } from './entities/wishlist-item.entity';
import { WishlistPriceScheduler } from './wishlists.scheduler';

@Module({
  imports: [TypeOrmModule.forFeature([Wishlist, WishlistItem])],
  controllers: [WishlistsController],
  providers: [
    WishlistsService,
    WishlistPriceScheduler,
    // To plug in a real notification service:
    // { provide: NOTIFICATION_SERVICE, useClass: YourNotificationService }
  ],
  exports: [WishlistsService],
})
export class WishlistsModule {}