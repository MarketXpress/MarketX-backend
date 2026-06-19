import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { Users } from '../users/users.entity';
import { Order } from '../orders/entities/order.entity';
import { Product } from '../entities/product.entity';
import { AdminGuard } from '../guards/admin.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Users, Order, Product])],
  controllers: [AdminController],
  providers: [AdminService, AdminGuard, JwtAuthGuard],
  exports: [AdminService],
})
export class AdminModule {}
