import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { StellarWebhookController } from './stellar-webhook.controller';
import { StellarWebhookProcessor } from './stellar-webhook.processor';
import { Escrow } from '../entities/escrow.entity';
import { Order } from '../entities/order.entity';
import { Transaction } from '../entities/transaction.entity';
import { LoggerModule } from '../common/logger/logger.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Escrow, Order, Transaction]),
    BullModule.registerQueue({
      name: 'stellar-webhook',
    }),
    LoggerModule,
  ],
  controllers: [StellarWebhookController],
  providers: [StellarWebhookProcessor],
})
export class WebhooksModule {}
