// src/admin/admin.service.ts

import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Users } from '../users/users.entity';
import { Order } from '../orders/entities/order.entity';
import { AdminStatsDto } from './dtos/admin-stats.dto';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(Users)
    private readonly userRepository: Repository<Users>,

    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
  ) {}

  /** Get all users (admin-only) */
  async getAllUsers(): Promise<Users[]> {
    return this.userRepository.find();
  }

  /** Suspend a user by ID */
  async suspendUser(userId: string): Promise<Users> {
    const user = await this.userRepository.findOne({ where: { id: parseInt(userId) } });
    if (!user) throw new ForbiddenException('User not found');
    user.role = 'SUSPENDED'; // simple approach, adjust as needed
    return this.userRepository.save(user);
  }

  /** Activate a suspended user */
  async activateUser(userId: string): Promise<Users> {
    const user = await this.userRepository.findOne({ where: { id: parseInt(userId) } });
    if (!user) throw new ForbiddenException('User not found');
    user.role = 'USER';
    return this.userRepository.save(user);
  }

  /** Get all orders/transactions */
  async getAllOrders(): Promise<Order[]> {
    return this.orderRepository.find({ relations: ['user'] });
  }

  /** Generate platform statistics */
  async getPlatformStats(): Promise<AdminStatsDto> {
    const totalUsers = await this.userRepository.count();
    const activeUsers = await this.userRepository.count({ where: { role: 'USER' } });
    const totalSales = await this.orderRepository
      .createQueryBuilder('order')
      .select('SUM(order.amount)', 'sum')
      .getRawOne();

    return {
      totalUsers,
      activeUsers,
      totalOrders: await this.orderRepository.count(),
      totalSales: Number(totalSales.sum) || 0,
    };
  }
}
