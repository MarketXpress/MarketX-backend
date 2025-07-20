import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { Escrow } from './escrow.entity';
import { EscrowService } from './escrow.service';
import { EscrowController } from './escrow.controller';
import { TransactionsModule } from '../transactions/transactions.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Escrow]),
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      envFilePath: '.env',
    }),
    TransactionsModule,
  ],
  providers: [EscrowService],
  controllers: [EscrowController],
  exports: [EscrowService, TypeOrmModule],
})
export class EscrowModule {}
