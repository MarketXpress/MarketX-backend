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
import { AdminWebhookService } from './admin-webhook.service';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Order, FraudAlert]), // import entities used by AdminService
    HttpModule,
  ],
  controllers: [AdminController, AdminFraudController],
  providers: [AdminService, AdminWebhookService],
  exports: [AdminService, AdminWebhookService],
})
export class AdminModule {}
