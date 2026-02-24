import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Refund } from './entities/refund.entity';
import { RefundsService } from './refunds.service';
import { RefundsController } from './refunds.controller';
import { OrdersModule } from '../orders/orders.module';
import { EscrowModule } from '../escrowes/escrow.module';

@Module({
  imports: [TypeOrmModule.forFeature([Refund]), OrdersModule, EscrowModule],
  controllers: [RefundsController],
  providers: [RefundsService],
  exports: [RefundsService],
})
export class RefundsModule {}
