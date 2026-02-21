import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Listing } from '../listing/entities/listing.entity';
import { Product } from '../entities/product.entity';
import { InventoryHistory } from './inventory-history.entity';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Listing, Product, InventoryHistory]),
    forwardRef(() => NotificationsModule),
    EventEmitterModule.forRoot(),
  ],
  providers: [InventoryService],
  controllers: [InventoryController],
  exports: [InventoryService],
})
export class InventoryModule {}
