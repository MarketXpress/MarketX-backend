import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import {
  AuditLog,
  AuditActionType,
  AuditStatus,
} from './entities/audit-log.entity';
import { GetAuditLogsDto } from './dto/get-audit-logs.dto';
import { IAuditEvent } from './interfaces/audit-event.interface';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
  ) {}

  /**
   * Calculate the differences between previous and new state
   * Returns a diff object with field-level changes
   */
  private calculateStateDiff(
    previous: Record<string, any> | undefined,
    current: Record<string, any> | undefined,
  ): {
    diff: Record<string, { previous: any; new: any }>;
    changedFields: string[];
  } {
    const diff: Record<string, { previous: any; new: any }> = {};
    const changedFields: string[] = [];

    if (!previous && !current) {
      return { diff: {}, changedFields: [] };
    }

    // Get all keys from both objects
    const allKeys = new Set([
      ...(previous ? Object.keys(previous) : []),
      ...(current ? Object.keys(current) : []),
    ]);

    allKeys.forEach((key) => {
      const prevValue = previous?.[key];
      const currValue = current?.[key];

      // Only record if values actually differ
      if (JSON.stringify(prevValue) !== JSON.stringify(currValue)) {
        diff[key] = {
          previous: prevValue,
          new: currValue,
        };
        changedFields.push(key);
      }
    });

    return { diff, changedFields };
  }

  /**
   * Create an immutable audit log entry with state tracking
   * This method ensures append-only behavior for compliance logging
   */
  async createAuditLog(data: {
    userId: string;
    action: AuditActionType;
    status?: AuditStatus;
    ipAddress?: string;
    userAgent?: string;
    resourceType?: string;
    resourceId?: string;
    details?: Record<string, any>;
    errorMessage?: string;
  }): Promise<AuditLog> {
    try {
      const auditLog = this.auditLogRepository.create(data);
      return await this.auditLogRepository.save(auditLog);
    } catch (error) {
      this.logger.error(
        `Failed to create audit log: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Log a state change event with automatic diff calculation
   * Focuses on compliance: Action Type, User ID, IP Address, Timestamp, and State Diffs
   */
  async logStateChange(event: IAuditEvent): Promise<AuditLog> {
    try {
      const { diff, changedFields } = this.calculateStateDiff(
        event.statePreviousValue,
        event.stateNewValue,
      );

      const auditLog = this.auditLogRepository.create({
        userId: event.userId,
        action: event.actionType as AuditActionType,
        status: event.status
          ? (event.status as AuditStatus)
          : AuditStatus.SUCCESS,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        resourceType: event.resourceType,
        resourceId: event.resourceId,
        statePreviousValue: event.statePreviousValue,
        stateNewValue: event.stateNewValue,
        stateDiff: diff,
        changedFields: changedFields.join(','),
        details: event.metadata,
        errorMessage: event.errorMessage,
      });

      const savedLog = await this.auditLogRepository.save(auditLog);

      this.logger.log(
        `Audit log created for user ${event.userId}: ${event.actionType} (${changedFields.join(', ')})`,
      );

      return savedLog;
    } catch (error) {
      this.logger.error(
        `Failed to log state change: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Batch create audit logs (useful for bulk operations)
   * Maintains immutability by appending only
   */
  async createBulkAuditLogs(events: IAuditEvent[]): Promise<AuditLog[]> {
    try {
      const auditLogs = events.map((event) => {
        const { diff, changedFields } = this.calculateStateDiff(
          event.statePreviousValue,
          event.stateNewValue,
        );

        return this.auditLogRepository.create({
          userId: event.userId,
          action: event.actionType as AuditActionType,
          status: event.status
            ? (event.status as AuditStatus)
            : AuditStatus.SUCCESS,
          ipAddress: event.ipAddress,
          userAgent: event.userAgent,
          resourceType: event.resourceType,
          resourceId: event.resourceId,
          statePreviousValue: event.statePreviousValue,
          stateNewValue: event.stateNewValue,
          stateDiff: diff,
          changedFields: changedFields.join(','),
          details: event.metadata,
          errorMessage: event.errorMessage,
        });
      });

      return await this.auditLogRepository.save(auditLogs);
    } catch (error) {
      this.logger.error(
        `Failed to create bulk audit logs: ${error.message}`,
        error.stack,
      );
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
      const queryBuilder =
        this.auditLogRepository.createQueryBuilder('audit_log');

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
        queryBuilder.andWhere('audit_log.resourceType = :resourceType', {
          resourceType,
        });
      }

      if (resourceId) {
        queryBuilder.andWhere('audit_log.resourceId = :resourceId', {
          resourceId,
        });
      }

      if (startDate && endDate) {
        queryBuilder.andWhere(
          'audit_log.createdAt BETWEEN :startDate AND :endDate',
          {
            startDate,
            endDate,
          },
        );
      } else if (startDate) {
        queryBuilder.andWhere('audit_log.createdAt >= :startDate', {
          startDate,
        });
      } else if (endDate) {
        queryBuilder.andWhere('audit_log.createdAt <= :endDate', { endDate });
      }

      if (!includeExpired) {
        queryBuilder.andWhere(
          '(audit_log.expiresAt IS NULL OR audit_log.expiresAt > NOW())',
        );
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
      this.logger.error(
        `Failed to get audit logs: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get audit logs filtered by changed fields
   * Useful for compliance: "show me all password changes"
   */
  async getAuditLogsByChangedFields(
    changedField: string,
    options?: { startDate?: Date; endDate?: Date; userId?: string },
  ): Promise<AuditLog[]> {
    try {
      const queryBuilder =
        this.auditLogRepository.createQueryBuilder('audit_log');

      queryBuilder.where('audit_log.changedFields LIKE :changedField', {
        changedField: `%${changedField}%`,
      });

      if (options?.startDate) {
        queryBuilder.andWhere('audit_log.createdAt >= :startDate', {
          startDate: options.startDate,
        });
      }

      if (options?.endDate) {
        queryBuilder.andWhere('audit_log.createdAt <= :endDate', {
          endDate: options.endDate,
        });
      }

      if (options?.userId) {
        queryBuilder.andWhere('audit_log.userId = :userId', {
          userId: options.userId,
        });
      }

      return await queryBuilder
        .orderBy('audit_log.createdAt', 'DESC')
        .getMany();
    } catch (error) {
      this.logger.error(
        `Failed to get audit logs by changed fields: ${error.message}`,
        error.stack,
      );
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
      this.logger.error(
        `Failed to get audit stats: ${error.message}`,
        error.stack,
      );
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
          retentionDate: new Date(
            Date.now() - retentionDays * 24 * 60 * 60 * 1000,
          ),
        })
        .execute();

      return result.affected || 0;
    } catch (error) {
      this.logger.error(
        `Failed to cleanup expired logs: ${error.message}`,
        error.stack,
      );
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
      this.logger.error(
        `Failed to get audit log by ID: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
