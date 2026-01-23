// src/admin/admin.controller.ts

import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminStatsDto } from './dto/admin-stats.dto';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';

@Controller('admin')
@UseGuards(RolesGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  /**
   * GET /admin/users
   * Fetch all users
   */
  @Get('users')
  @Roles('ADMIN')
  async getUsers() {
    return this.adminService.getAllUsers();
  }

  /**
   * GET /admin/orders
   * Fetch all orders
   */
  @Get('orders')
  @Roles('ADMIN')
  async getOrders() {
    return this.adminService.getAllOrders();
  }

  /**
   * GET /admin/stats
   * Fetch platform statistics
   */
  @Get('stats')
  @Roles('ADMIN')
  async getStats(): Promise<AdminStatsDto> {
    return this.adminService.getPlatformStats();
  }

  /**
   * PATCH /admin/users/:id/suspend
   * Suspend a user
   */
  @Patch('users/:id/suspend')
  @Roles('ADMIN')
  async suspendUser(@Param('id') id: string) {
    return this.adminService.suspendUser(id);
  }

  /**
   * PATCH /admin/users/:id/activate
   * Activate a user
   */
  @Patch('users/:id/activate')
  @Roles('ADMIN')
  async activateUser(@Param('id') id: string) {
    return this.adminService.activateUser(id);
  }
}
