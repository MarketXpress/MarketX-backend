import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';

import { PaymentsService } from './payments.service';
import { PaymentMonitorService } from './payment-monitor.service';
import { PaymentsController } from './payments.controller';
import { Payment } from './entities/payment.entity';
import { Order } from '../orders/entities/order.entity';
import { Wallet } from '../wallet/entities/wallet.entity';
import { OrdersModule } from '../orders/orders.module';
import { WalletModule } from '../wallet/wallet.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { LoggerModule } from '../common/logger/logger.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, Order, Wallet]),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    OrdersModule,
    WalletModule,
    WebhooksModule,
    LoggerModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymentMonitorService],
  exports: [PaymentsService, PaymentMonitorService],
})
export class PaymentsModule {}
