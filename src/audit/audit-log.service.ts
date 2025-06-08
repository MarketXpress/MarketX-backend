import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog, AuditAction } from './audit-log.entity';
import { Between } from 'typeorm';

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  async log(
    userId: string,
    action: AuditAction,
    meta: Record<string, any> = {},
    context?: {
      ipAddress?: string;
      userAgent?: string;
      status?: string;
      errorMessage?: string;
    },
  ): Promise<AuditLog> {
    try {
      const auditLog = this.auditLogRepository.create({
        userId,
        action,
        meta,
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
        status: context?.status || 'SUCCESS',
        errorMessage: context?.errorMessage,
      });

      const savedLog = await this.auditLogRepository.save(auditLog);
      this.logger.debug(`Audit log created: ${action} for user ${userId}`);
      return savedLog;
    } catch (error) {
      this.logger.error(
        `Failed to create audit log: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async logWalletRegeneration(
    userId: string,
    walletAddress: string,
    context?: { ipAddress?: string; userAgent?: string },
  ): Promise<AuditLog> {
    return this.log(
      userId,
      AuditAction.WALLET_REGENERATION,
      { walletAddress },
      context,
    );
  }

  async logProfileUpdate(
    userId: string,
    updatedFields: Record<string, any>,
    context?: { ipAddress?: string; userAgent?: string },
  ): Promise<AuditLog> {
    return this.log(
      userId,
      AuditAction.PROFILE_UPDATE,
      { updatedFields },
      context,
    );
  }

  async logPasswordUpdate(
    userId: string,
    context?: { ipAddress?: string; userAgent?: string },
  ): Promise<AuditLog> {
    return this.log(
      userId,
      AuditAction.PASSWORD_UPDATE,
      { timestamp: new Date().toISOString() },
      context,
    );
  }

  async logLoginAttempt(
    userId: string,
    success: boolean,
    context?: {
      ipAddress?: string;
      userAgent?: string;
      errorMessage?: string;
    },
  ): Promise<AuditLog> {
    return this.log(
      userId,
      AuditAction.LOGIN_ATTEMPT,
      { success },
      {
        ...context,
        status: success ? 'SUCCESS' : 'FAILED',
      },
    );
  }

  async logWalletTransaction(
    userId: string,
    transactionDetails: {
      type: string;
      amount: string;
      currency: string;
      transactionId: string;
    },
    context?: { ipAddress?: string; userAgent?: string },
  ): Promise<AuditLog> {
    return this.log(
      userId,
      AuditAction.WALLET_TRANSACTION,
      transactionDetails,
      context,
    );
  }

  async logAccountDeletion(
    userId: string,
    reason: string,
    context?: { ipAddress?: string; userAgent?: string },
  ): Promise<AuditLog> {
    return this.log(
      userId,
      AuditAction.ACCOUNT_DELETION,
      { reason },
      context,
    );
  }

  async logRoleChange(
    userId: string,
    oldRole: string,
    newRole: string,
    changedBy: string,
    context?: { ipAddress?: string; userAgent?: string },
  ): Promise<AuditLog> {
    return this.log(
      userId,
      AuditAction.ROLE_CHANGE,
      { oldRole, newRole, changedBy },
      context,
    );
  }

  async findByUserId(userId: string): Promise<AuditLog[]> {
    return this.auditLogRepository.find({
      where: { userId },
      order: { timestamp: 'DESC' },
    });
  }

  async findByAction(action: AuditAction): Promise<AuditLog[]> {
    return this.auditLogRepository.find({
      where: { action },
      order: { timestamp: 'DESC' },
    });
  }

  async findByDateRange(
    startDate: Date,
    endDate: Date,
  ): Promise<AuditLog[]> {
    return this.auditLogRepository.find({
      where: {
        timestamp: Between(startDate, endDate),
      },
      order: { timestamp: 'DESC' },
    });
  }
} 