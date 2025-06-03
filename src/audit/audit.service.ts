import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { AuditLog, AuditActionType, AuditStatus } from './entities/audit-log.entity';
import { GetAuditLogsDto } from './dto/get-audit-logs.dto';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
  ) {}

  async createAuditLog(data: Partial<AuditLog>): Promise<AuditLog> {
    try {
      const auditLog = this.auditLogRepository.create(data);
      return await this.auditLogRepository.save(auditLog);
    } catch (error) {
      this.logger.error(`Failed to create audit log: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getAuditLogs(query: GetAuditLogsDto) {
    try {
      const {
        page = 1,
        limit = 10,
        action,
        userId,
        status,
        resourceType,
        resourceId,
        startDate,
        endDate,
        includeExpired = false,
        sortBy = 'createdAt',
        sortOrder = 'DESC',
      } = query;

      const skip = (page - 1) * limit;
      const queryBuilder = this.auditLogRepository.createQueryBuilder('audit_log');

      // Apply filters
      if (action) {
        queryBuilder.andWhere('audit_log.action = :action', { action });
      }

      if (userId) {
        queryBuilder.andWhere('audit_log.userId = :userId', { userId });
      }

      if (status) {
        queryBuilder.andWhere('audit_log.status = :status', { status });
      }

      if (resourceType) {
        queryBuilder.andWhere('audit_log.resourceType = :resourceType', { resourceType });
      }

      if (resourceId) {
        queryBuilder.andWhere('audit_log.resourceId = :resourceId', { resourceId });
      }

      if (startDate && endDate) {
        queryBuilder.andWhere('audit_log.createdAt BETWEEN :startDate AND :endDate', {
          startDate,
          endDate,
        });
      } else if (startDate) {
        queryBuilder.andWhere('audit_log.createdAt >= :startDate', { startDate });
      } else if (endDate) {
        queryBuilder.andWhere('audit_log.createdAt <= :endDate', { endDate });
      }

      if (!includeExpired) {
        queryBuilder.andWhere('(audit_log.expiresAt IS NULL OR audit_log.expiresAt > NOW())');
      }

      // Apply sorting
      queryBuilder.orderBy(`audit_log.${sortBy}`, sortOrder);

      const [logs, total] = await queryBuilder
        .skip(skip)
        .take(limit)
        .getManyAndCount();

      return {
        data: logs,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get audit logs: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getAuditStats(startDate: Date, endDate: Date) {
    try {
      const stats = await this.auditLogRepository
        .createQueryBuilder('audit_log')
        .select('audit_log.action', 'action')
        .addSelect('audit_log.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .where('audit_log.createdAt BETWEEN :startDate AND :endDate', {
          startDate,
          endDate,
        })
        .groupBy('audit_log.action')
        .addGroupBy('audit_log.status')
        .getRawMany();

      return stats;
    } catch (error) {
      this.logger.error(`Failed to get audit stats: ${error.message}`, error.stack);
      throw error;
    }
  }

  async cleanupExpiredLogs(retentionDays: number = 90): Promise<number> {
    try {
      const result = await this.auditLogRepository
        .createQueryBuilder()
        .delete()
        .from(AuditLog)
        .where('expiresAt < :date', { date: new Date() })
        .orWhere('createdAt < :retentionDate', {
          retentionDate: new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000),
        })
        .execute();

      return result.affected || 0;
    } catch (error) {
      this.logger.error(`Failed to cleanup expired logs: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getAuditLogById(id: string): Promise<AuditLog> {
    try {
      const log = await this.auditLogRepository.findOne({ where: { id } });
      if (!log) {
        throw new Error(`Audit log with ID ${id} not found`);
      }
      return log;
    } catch (error) {
      this.logger.error(`Failed to get audit log by ID: ${error.message}`, error.stack);
      throw error;
    }
  }
} 