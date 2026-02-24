/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReturnRequest, RefundHistory } from './entities';
import { RefundsController } from './refunds.controller';
import { RefundsService } from './refunds.service';
import { Refund } from './entities/refund.entity';
import { OrdersModule } from '../orders/orders.module';
import { EscrowModule } from '../escrowes/escrow.module';
import { RefundsController } from './refunds.controller';
import { Order } from '../orders/entities/order.entity';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ReturnRequest,
      RefundHistory,
      Order,
      Refund,
    ]),
    InventoryModule,
    OrdersModule, 
    EscrowModule
  ],
  providers: [RefundsService],
  controllers: [RefundsController],
  exports: [RefundsService],
})
export class RefundsModule {}
