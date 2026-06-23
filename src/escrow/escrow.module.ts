import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Escrow } from '../entities/escrow.entity';
import { Order } from '../entities/order.entity';
import { EscrowService } from './escrow.service';
import { EscrowController } from './escrow.controller';
import { LoggerModule } from '../common/logger/logger.module';
import { DisputeSubscriber } from './subscribers/dispute.subscriber';

@Module({
  imports: [TypeOrmModule.forFeature([Escrow, Order]), LoggerModule],
  controllers: [EscrowController],
  providers: [EscrowService, DisputeSubscriber],
  exports: [EscrowService],
})
export class EscrowModule {}
