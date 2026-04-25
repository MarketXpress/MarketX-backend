import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  Query,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { FraudAlert } from '../fraud/entities/fraud-alert.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../guards/admin.guard';
import { Roles } from '../decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { AuditActionType, AuditStatus } from '../audit/entities/audit-log.entity';

@Controller('admin/fraud')
@UseGuards(JwtAuthGuard, AdminGuard)
@Roles('admin')
export class AdminFraudController {
  constructor(
    @InjectRepository(FraudAlert)
    private readonly repo: Repository<FraudAlert>,
    private readonly eventEmitter: EventEmitter2,
    private readonly auditService: AuditService,
  ) {}

  @Get('alerts')
  async list(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
    @Query('userId') userId?: string,
  ) {
    const queryBuilder = this.repo.createQueryBuilder('alert');

    if (status) {
      queryBuilder.andWhere('alert.status = :status', { status });
    }

    if (userId) {
      queryBuilder.andWhere('alert.userId = :userId', { userId });
    }

    queryBuilder.orderBy('alert.createdAt', 'DESC');

    const pageNum = parseInt(page as any) || 1;
    const limitNum = parseInt(limit as any) || 100;

    queryBuilder.skip((pageNum - 1) * limitNum).take(limitNum);

    const [items, total] = await queryBuilder.getManyAndCount();

    return {
      data: items,
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    const alert = await this.repo.findOne({ where: { id } as any });
    if (!alert) {
      return { error: 'Alert not found' };
    }
    return alert;
  }

  @Patch(':id/review')
  async review(
    @Param('id') id: string,
    @Body()
    body: {
      mark: 'safe' | 'reviewed' | 'suspended';
      notes?: string;
    },
    @CurrentUser() user?: any,
  ) {
    const alert = await this.repo.findOne({ where: { id } as any });
    if (!alert) {
      return { error: 'Alert not found' };
    }

    const previousStatus = alert.status;
    alert.status = body.mark;
    alert.reviewedBy = user?.id || 'admin';
    alert.reviewedAt = new Date();
    alert.reviewNotes = body.notes || undefined;
    await this.repo.save(alert);

    // Emit audit event for fraud review
    this.eventEmitter.emit('fraud.alert_reviewed', {
      userId: user?.id || 'admin',
      actionType: AuditActionType.FRAUD_REVIEW,
      status: AuditStatus.SUCCESS,
      resourceType: 'fraud_alert',
      resourceId: id,
      statePreviousValue: { status: previousStatus },
      stateNewValue: { status: body.mark, notes: body.notes },
      metadata: {
        alertId: id,
        userId: alert.userId,
        riskScore: alert.riskScore,
        previousStatus,
        newStatus: body.mark,
        reviewer: user?.id || 'admin',
      },
    });

    return alert;
  }

  @Get(':id/audit-trail')
  async getAuditTrail(@Param('id') id: string) {
    const alert = await this.repo.findOne({ where: { id } as any });
    if (!alert) {
      return { error: 'Alert not found' };
    }

    // Get all audit logs related to this fraud alert
    const auditLogs = await this.auditService.getAuditLogs({
      page: 1,
      limit: 100,
      resourceId: id,
      resourceType: 'fraud_alert',
    });

    // Also get lockout events if this alert caused a lockout
    if (alert.userId) {
      const lockoutLogs = await this.auditService.getAuditLogs({
        page: 1,
        limit: 100,
        userId: alert.userId,
        action: AuditActionType.FRAUD_LOCKOUT,
      });

      return {
        alert,
        auditTrail: {
          alertEvents: auditLogs.data,
          lockoutEvents: lockoutLogs.data,
          total: auditLogs.meta.total + lockoutLogs.meta.total,
        },
      };
    }

    return {
      alert,
      auditTrail: {
        alertEvents: auditLogs.data,
        lockoutEvents: [],
        total: auditLogs.meta.total,
      },
    };
  }

  @Get('lockouts')
  async getLockouts(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('userId') userId?: string,
  ) {
    const pageNum = parseInt(page as any) || 1;
    const limitNum = parseInt(limit as any) || 50;

    const query: any = {
      page: pageNum,
      limit: limitNum,
      action: AuditActionType.FRAUD_LOCKOUT,
    };

    if (userId) {
      query.userId = userId;
    }

    return this.auditService.getAuditLogs(query);
  }

  @Get('stats')
  async getStats() {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [alerts24h, alerts7d, alerts30d, lockouts24h, lockouts7d] =
      await Promise.all([
        this.repo.count({
          where: { createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000) } as any,
        }),
        this.repo.count({
          where: { createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } as any,
        }),
        this.repo.count({
          where: { createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } as any,
        }),
        this.auditService.getAuditLogs({
          page: 1,
          limit: 1,
          action: AuditActionType.FRAUD_LOCKOUT,
          startDate: last24Hours.toISOString(),
        }),
        this.auditService.getAuditLogs({
          page: 1,
          limit: 1,
          action: AuditActionType.FRAUD_LOCKOUT,
          startDate: last7Days.toISOString(),
        }),
      ]);

    return {
      alerts: {
        last24Hours: alerts24h,
        last7Days: alerts7d,
        last30Days: alerts30d,
      },
      lockouts: {
        last24Hours: lockouts24h.meta.total,
        last7Days: lockouts7d.meta.total,
      },
    };
  }
}
