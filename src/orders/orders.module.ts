import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CouponsModule } from '../coupons/coupons.module';
import { InventoryModule } from '../inventory/inventory.module';
import { ProductsModule } from '../products/products.module';
import { AdminModule } from '../admin/admin.module';
import { LoggerModule } from '../common/logger/logger.module';
import { Order } from './entities/order.entity';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrderStateSubscriber } from './subscribers/order-state.subscriber';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order]),
    ProductsModule,
    CouponsModule,
    InventoryModule,
    AdminModule,
    LoggerModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService, OrderStateSubscriber],
  exports: [OrdersService, TypeOrmModule],
})
export class OrdersModule {}
