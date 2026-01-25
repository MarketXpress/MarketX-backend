import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';

import { PaymentsService } from './payments.service';
import { PaymentMonitorService } from './payment-monitor.service';
import { PaymentsController } from './payments.controller';
import { Payment } from './entities/payment.entity';
import { Order } from 'src/orders/entities/order.entity';
import { Wallet } from 'src/wallet/entities/wallet.entity';
import { OrdersModule } from 'src/orders/orders.module';
import { WalletModule } from 'src/wallet/wallet.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, Order, Wallet]),
    ConfigModule,
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    OrdersModule,
    WalletModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymentMonitorService],
  exports: [PaymentsService, PaymentMonitorService],
})
export class PaymentsModule {}
