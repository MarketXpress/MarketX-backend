// src/admin/admin.module.ts

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { Order } from '../orders/entities/order.entity';
import { UsersModule } from 'src/Authentication/user.module';
import { AdminService } from './admin.service';
import { User } from 'src/profile/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Order]), // import entities used by AdminService
  ],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
