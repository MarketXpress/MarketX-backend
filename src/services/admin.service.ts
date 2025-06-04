import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async getAllUsers(page: number = 1, limit: number = 10) {
    const [users, total] = await this.userRepository.findAndCount({
      take: limit,
      skip: (page - 1) * limit,
      order: { createdAt: 'DESC' },
    });

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getUserById(id: number) {
    const user = await this.userRepository.findOne({ where: { id } });
    
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  async updateUserRole(id: number, role: string) {
    const user = await this.getUserById(id);
    
    user.role = role;
    await this.userRepository.save(user);

    this.logger.log(`Updated user ${id} role to ${role}`);
    
    return {
      message: 'User role updated successfully',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  }

  async deleteUser(id: number) {
    const user = await this.getUserById(id);
    
    await this.userRepository.remove(user);
    
    this.logger.log(`Deleted user ${id}`);
    
    return {
      message: 'User deleted successfully',
      deletedUserId: id,
    };
  }

  async getSystemStatistics() {
    const [
      totalUsers,
      adminUsers,
      moderatorUsers,
      regularUsers,
    ] = await Promise.all([
      this.userRepository.count(),
      this.userRepository.count({ where: { role: 'admin' } }),
      this.userRepository.count({ where: { role: 'moderator' } }),
      this.userRepository.count({ where: { role: 'user' } }),
    ]);

    const recentUsers = await this.userRepository.count({
      where: {
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
      },
    });

    return {
      users: {
        total: totalUsers,
        admin: adminUsers,
        moderator: moderatorUsers,
        regular: regularUsers,
        recentSignups: recentUsers,
      },
      timestamp: new Date().toISOString(),
    };
  }

  async toggleMaintenanceMode(enabled: boolean) {
    // This would typically update a system configuration
    // For now, we'll just return the status
    this.logger.log(`Maintenance mode ${enabled ? 'enabled' : 'disabled'}`);
    
    return {
      maintenanceMode: enabled,
      message: `Maintenance mode ${enabled ? 'enabled' : 'disabled'}`,
      timestamp: new Date().toISOString(),
    };
  }
}
