/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReturnRequest, RefundHistory } from './entities';
import { RefundsService } from './refunds.service';
import { RefundsController } from './refunds.controller';
import { Order } from '../orders/entities/order.entity';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ReturnRequest,
      RefundHistory,
      Order,
    ]),
    InventoryModule,
  ],
  providers: [RefundsService],
  controllers: [RefundsController],
  exports: [RefundsService],
})
export class RefundsModule {}
