import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArchivingService } from './archiving.service';
import { ArchivedOrder } from './entities/archived-order.entity';
import { ArchivedTransaction } from './entities/archived-transaction.entity';
import { Order } from '../orders/entities/order.entity';
import { Transaction } from '../transactions/entities/transaction.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ArchivedOrder,
      ArchivedTransaction,
      Order,
      Transaction,
    ]),
  ],
  providers: [ArchivingService],
  exports: [ArchivingService],
})
export class ArchivingModule {}
