// src/admin/dto/admin-stats.dto.ts

import { ApiProperty } from '@nestjs/swagger';

export class AdminStatsDto {
  @ApiProperty({
    description: 'Total number of users in the platform',
    example: 1500,
  })
  totalUsers: number;

  @ApiProperty({
    description: 'Total number of orders placed',
    example: 3450,
  })
  totalOrders: number;

  @ApiProperty({
    description: 'Total sales value of all orders',
    example: 1250000,
  })
  totalSales: number;

  @ApiProperty({
    description: 'Number of active users',
    example: 1200,
  })
  activeUsers: number;
}
