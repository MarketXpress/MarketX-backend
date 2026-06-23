import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

import { Escrow } from '../entities/escrow.entity';
import { LoggerModule } from '../common/logger/logger.module';
import { EscrowService } from './escrow.service';
import { EscrowController } from './escrow.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Escrow]), ConfigModule, LoggerModule],
  controllers: [EscrowController],
  providers: [EscrowService],
  exports: [EscrowService],
})
export class EscrowModule {}
