// src/admin/admin.module.ts

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminFraudController } from './admin-fraud.controller';
import { AdminEscrowController } from './admin-escrow.controller';
import { Order } from '../orders/entities/order.entity';
import { UsersModule } from 'src/Authentication/user.module';
import { AdminService } from './admin.service';
import { User } from 'src/profile/user.entity';
import { FraudAlert } from '../fraud/entities/fraud-alert.entity';
import { EscrowEntity } from '../escrowes/entities/escrow.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Order, FraudAlert, EscrowEntity]), // import entities used by AdminService
  ],
  controllers: [AdminController, AdminFraudController, AdminEscrowController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
