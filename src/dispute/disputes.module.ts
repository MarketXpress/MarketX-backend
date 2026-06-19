import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DisputesService } from './disputes.service';
import { DisputesController } from './disputes.controller';
import { Dispute } from './disputes.entity';
import { OrdersModule } from '../orders/orders.module'; // Import module to leverage inner service calls safely

@Module({
  imports: [
    TypeOrmModule.forFeature([Dispute]),
    OrdersModule, // Wired up cleanly to utilize ordersService state management definitions
  ],
  providers: [DisputesService],
  controllers: [DisputesController],
  exports: [DisputesService],
})
export class DisputesModule {}
