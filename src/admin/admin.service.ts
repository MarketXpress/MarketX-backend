import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Users } from '../users/users.entity';
import { Order } from '../orders/entities/order.entity';
import { Product } from '../entities/product.entity';
import { OrderStatus } from '../common/enums/order-status.enum';

export interface AdminUserListResult {
  items: Array<{
    id: number;
    email: string;
    name: string;
    bio: string | null;
    avatarUrl: string | null;
    role: string | null;
    status: string | null;
    isActive: boolean;
    isBanned: boolean;
    language: string | null;
    createdAt: Date;
    updatedAt: Date;
  }>;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AdminStatsResult {
  totalUsers: number;
  totalProducts: number;
  totalOrders: number;
  revenue: number;
}

export interface FraudAlertRow {
  id: string;
  userId: string | null;
  orderId: string | null;
  ip: string | null;
  deviceFingerprint: string | null;
  riskScore: number;
  reason: string | null;
  status: string;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(Users)
    private readonly usersRepository: Repository<Users>,
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
    private readonly dataSource: DataSource,
  ) {}

  async getStats(): Promise<AdminStatsResult> {
    const [totalUsers, totalProducts, totalOrders, revenueRow] =
      await Promise.all([
        this.usersRepository.count(),
        this.productsRepository.count(),
        this.ordersRepository.count(),
        this.ordersRepository
          .createQueryBuilder('order')
          .select('COALESCE(SUM(order.totalAmount), 0)', 'revenue')
          .where('order.status = :status', { status: OrderStatus.COMPLETED })
          .getRawOne<{ revenue: string | number }>(),
      ]);

    return {
      totalUsers,
      totalProducts,
      totalOrders,
      revenue: Number(revenueRow?.revenue ?? 0),
    };
  }

  async getUsers(
    page = 1,
    limit = 20,
    role?: string,
  ): Promise<AdminUserListResult> {
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const safePage = Math.max(page, 1);

    const query = this.usersRepository
      .createQueryBuilder('user')
      .select([
        'user.id',
        'user.email',
        'user.name',
        'user.bio',
        'user.avatarUrl',
        'user.role',
        'user.status',
        'user.isActive',
        'user.isBanned',
        'user.language',
        'user.createdAt',
        'user.updatedAt',
      ])
      .orderBy('user.createdAt', 'DESC')
      .skip((safePage - 1) * safeLimit)
      .take(safeLimit);

    if (role) {
      query.andWhere('user.role = :role', { role });
    }

    const [items, total] = await query.getManyAndCount();

    return {
      items,
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.max(1, Math.ceil(total / safeLimit)),
    };
  }

  async banUser(id: number) {
    const user = await this.usersRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    user.isBanned = true;
    await this.usersRepository.save(user);

    return this.usersRepository
      .createQueryBuilder('user')
      .select([
        'user.id',
        'user.email',
        'user.name',
        'user.bio',
        'user.avatarUrl',
        'user.role',
        'user.status',
        'user.isActive',
        'user.isBanned',
        'user.language',
        'user.createdAt',
        'user.updatedAt',
      ])
      .where('user.id = :id', { id })
      .getOne();
  }

  async getFraudAlerts(): Promise<FraudAlertRow[]> {
    const rows = await this.dataSource.query(
      'SELECT * FROM fraud_alerts ORDER BY "createdAt" DESC',
    );

    return rows.map((row: any) => ({
      id: row.id,
      userId: row.userId ?? null,
      orderId: row.orderId ?? null,
      ip: row.ip ?? null,
      deviceFingerprint: row.deviceFingerprint ?? null,
      riskScore: Number(row.riskScore),
      reason: row.reason ?? null,
      status: row.status,
      metadata: row.metadata ?? null,
      createdAt: row.createdAt,
    }));
  }
}
