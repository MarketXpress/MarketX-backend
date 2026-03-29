import { Controller, Get, Query, UseGuards, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EscrowEntity, EscrowStatus } from '../escrowes/entities/escrow.entity';
import { GetPendingEscrowsDto } from './dtos/get-pending-escrows.dto';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

/**
 * Admin Escrow Controller
 * Provides admin visibility into frozen and aging escrows
 * Tightly guarded by @Roles('admin')
 */
@ApiTags('Admin Escrow Management')
@ApiBearerAuth()
@Controller('admin/escrows')
@UseGuards(RolesGuard)
export class AdminEscrowController {
  private readonly logger = new Logger(AdminEscrowController.name);

  constructor(
    @InjectRepository(EscrowEntity)
    private readonly escrowRepository: Repository<EscrowEntity>,
  ) {}

  /**
   * GET /admin/escrows/pending
   * Paginated endpoint showing aging escrows for admin visibility
   * Helps customer support teams identify frozen assets that need attention
   */
  @Get('pending')
  @Roles('admin')
  @ApiOperation({
    summary: 'Get paginated pending/aging escrows',
    description:
      'Returns a paginated list of escrows that are pending, locked, frozen, or otherwise aging. ' +
      'This helps admins and customer support identify issues requiring attention.',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns paginated list of aging escrows with metadata',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  async getPendingEscrows(@Query() query: GetPendingEscrowsDto) {
    const { page = 1, limit = 10, status, olderThan, newerThan } = query;
    const skip = (page - 1) * limit;

    this.logger.log(
      `Fetching pending escrows - page: ${page}, limit: ${limit}, status: ${status || 'all'}`,
    );

    const queryBuilder = this.escrowRepository.createQueryBuilder('escrow');

    // Filter by escrow statuses that represent "aging" or problematic escrows
    // Include: PENDING, LOCKED, FROZEN, PARTIALLY_RELEASED
    const agingStatuses = [
      EscrowStatus.PENDING,
      EscrowStatus.LOCKED,
      EscrowStatus.FROZEN,
      EscrowStatus.PARTIALLY_RELEASED,
    ];

    if (status) {
      // If specific status is requested, use that
      queryBuilder.andWhere('escrow.status = :status', { status });
    } else {
      // Otherwise filter by aging statuses
      queryBuilder.andWhere('escrow.status IN (:...agingStatuses)', {
        agingStatuses,
      });
    }

    // Apply date filters for aging analysis
    if (olderThan) {
      queryBuilder.andWhere('escrow.createdAt <= :olderThan', {
        olderThan: new Date(olderThan),
      });
    }

    if (newerThan) {
      queryBuilder.andWhere('escrow.createdAt >= :newerThan', {
        newerThan: new Date(newerThan),
      });
    }

    // Order by oldest first to show most aging escrows
    queryBuilder.orderBy('escrow.createdAt', 'ASC');

    const [escrows, total] = await queryBuilder
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    // Calculate aging information for each escrow
    const escrowsWithAging = escrows.map((escrow) => {
      const now = new Date();
      const createdAt = new Date(escrow.createdAt);
      const ageInDays = Math.floor(
        (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24),
      );

      return {
        ...escrow,
        agingInfo: {
          ageInDays,
          createdAt: escrow.createdAt,
          updatedAt: escrow.updatedAt,
          isAging: ageInDays > 7, // Consider "aging" if older than 7 days
          isCritical: ageInDays > 30, // Consider "critical" if older than 30 days
        },
      };
    });

    this.logger.log(
      `Found ${total} total aging escrows, returning ${escrows.length} for page ${page}`,
    );

    return {
      data: escrowsWithAging,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * GET /admin/escrows/frozen
   * Get all frozen escrows (specifically for dispute handling)
   */
  @Get('frozen')
  @Roles('admin')
  @ApiOperation({
    summary: 'Get all frozen escrows',
    description:
      'Returns a list of all frozen escrows that are awaiting dispute resolution.',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns list of frozen escrows',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  async getFrozenEscrows(@Query() query: GetPendingEscrowsDto) {
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    this.logger.log(`Fetching frozen escrows - page: ${page}, limit: ${limit}`);

    const [escrows, total] = await this.escrowRepository.findAndCount({
      where: { status: EscrowStatus.FROZEN },
      order: { updatedAt: 'DESC' },
      skip,
      take: limit,
    });

    // Add aging info for frozen escrows
    const escrowsWithAging = escrows.map((escrow) => {
      const now = new Date();
      const updatedAt = new Date(escrow.updatedAt);
      const frozenDays = Math.floor(
        (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24),
      );

      return {
        ...escrow,
        agingInfo: {
          frozenDays,
          frozenSince: escrow.updatedAt,
          isCritical: frozenDays > 7,
        },
      };
    });

    return {
      data: escrowsWithAging,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * GET /admin/escrows/stats
   * Get escrow statistics for admin dashboard
   */
  @Get('stats')
  @Roles('admin')
  @ApiOperation({
    summary: 'Get escrow statistics',
    description:
      'Returns aggregate statistics about escrow statuses for admin dashboard.',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns escrow statistics',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  async getEscrowStats() {
    this.logger.log('Fetching escrow statistics');

    const stats = await this.escrowRepository
      .createQueryBuilder('escrow')
      .select('escrow.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(escrow.amount)', 'totalAmount')
      .groupBy('escrow.status')
      .getRawMany();

    const statusCounts = stats.reduce(
      (acc, stat) => {
        acc[stat.status] = {
          count: parseInt(stat.count, 10),
          totalAmount: parseFloat(stat.totalAmount || 0),
        };
        return acc;
      },
      {} as Record<string, { count: number; totalAmount: number }>,
    );

    // Calculate additional metrics
    const totalEscrows = Object.values(statusCounts).reduce(
      (sum: number, s: { count: number; totalAmount: number }) => sum + s.count,
      0,
    );

    const agingCount =
      (statusCounts[EscrowStatus.PENDING]?.count || 0) +
      (statusCounts[EscrowStatus.LOCKED]?.count || 0);

    const frozenCount = statusCounts[EscrowStatus.FROZEN]?.count || 0;

    return {
      totalEscrows,
      byStatus: statusCounts,
      agingCount,
      frozenCount,
      needsAttention: agingCount + frozenCount,
    };
  }
}
