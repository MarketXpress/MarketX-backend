import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IdempotencyModule } from '../common/idempotency/idempotency.module';
import { ProductsModule } from '../products/products.module';
import { LoggerModule } from '../common/logger/logger.module';
import { Order } from './entities/order.entity';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrdersExportService } from './orders-export.service';
import { OrderStateSubscriber } from './subscribers/order-state.subscriber';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order]),
    ProductsModule,
    LoggerModule,
    IdempotencyModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersExportService, OrderStateSubscriber],
  exports: [OrdersService, TypeOrmModule],
})
export class OrdersModule {}
