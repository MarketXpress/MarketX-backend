import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductsModule } from '../products/products.module';
import { LoggerModule } from '../common/logger/logger.module';
import { Order } from './entities/order.entity';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrderStateSubscriber } from './subscribers/order-state.subscriber';

@Module({
  imports: [TypeOrmModule.forFeature([Order]), ProductsModule, LoggerModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrderStateSubscriber],
  exports: [OrdersService, TypeOrmModule],
})
export class OrdersModule {}
