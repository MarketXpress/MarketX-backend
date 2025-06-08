import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, FindOptionsWhere } from 'typeorm';
import { AuditLog, AuditAction } from '../entities/audit-log.entity';

export interface AuditLogContext {
  ipAddress?: string;
  userAgent?: string;
  status?: string;
  errorMessage?: string;
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  /**
   * Base method for creating audit logs
   */
  async log(
    userId: string,
    action: AuditAction,
    meta: Record<string, any> = {},
    context: AuditLogContext = {},
  ): Promise<AuditLog> {
    try {
      const auditLog = this.auditLogRepository.create({
        userId,
        action,
        meta,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        status: context.status || 'SUCCESS',
        errorMessage: context.errorMessage,
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

  // Wallet Actions
  async logWalletRegeneration(
    userId: string,
    walletAddress: string,
    context?: AuditLogContext,
  ): Promise<AuditLog> {
    return this.log(
      userId,
      AuditAction.WALLET_REGENERATION,
      { walletAddress },
      context,
    );
  }

  async logWalletTransaction(
    userId: string,
    transactionDetails: {
      type: string;
      amount: string;
      currency: string;
      transactionId: string;
      fromAddress?: string;
      toAddress?: string;
    },
    context?: AuditLogContext,
  ): Promise<AuditLog> {
    return this.log(
      userId,
      AuditAction.WALLET_TRANSACTION,
      transactionDetails,
      context,
    );
  }

  // Profile Actions
  async logProfileUpdate(
    userId: string,
    updatedFields: Record<string, any>,
    context?: AuditLogContext,
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
    context?: AuditLogContext,
  ): Promise<AuditLog> {
    return this.log(
      userId,
      AuditAction.PASSWORD_UPDATE,
      { timestamp: new Date().toISOString() },
      context,
    );
  }

  async logEmailUpdate(
    userId: string,
    oldEmail: string,
    newEmail: string,
    context?: AuditLogContext,
  ): Promise<AuditLog> {
    return this.log(
      userId,
      AuditAction.EMAIL_UPDATE,
      { oldEmail, newEmail },
      context,
    );
  }

  async logPhoneUpdate(
    userId: string,
    oldPhone: string,
    newPhone: string,
    context?: AuditLogContext,
  ): Promise<AuditLog> {
    return this.log(
      userId,
      AuditAction.PHONE_UPDATE,
      { oldPhone, newPhone },
      context,
    );
  }

  // Security Actions
  async logLoginAttempt(
    userId: string,
    success: boolean,
    context?: AuditLogContext,
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

  async logLogout(
    userId: string,
    context?: AuditLogContext,
  ): Promise<AuditLog> {
    return this.log(
      userId,
      AuditAction.LOGOUT,
      { timestamp: new Date().toISOString() },
      context,
    );
  }

  async logTwoFactorChange(
    userId: string,
    enabled: boolean,
    context?: AuditLogContext,
  ): Promise<AuditLog> {
    return this.log(
      userId,
      enabled ? AuditAction.TWO_FACTOR_ENABLE : AuditAction.TWO_FACTOR_DISABLE,
      { timestamp: new Date().toISOString() },
      context,
    );
  }

  // Account Actions
  async logAccountDeletion(
    userId: string,
    reason: string,
    context?: AuditLogContext,
  ): Promise<AuditLog> {
    return this.log(
      userId,
      AuditAction.ACCOUNT_DELETION,
      { reason },
      context,
    );
  }

  async logAccountSuspension(
    userId: string,
    reason: string,
    suspendedBy: string,
    context?: AuditLogContext,
  ): Promise<AuditLog> {
    return this.log(
      userId,
      AuditAction.ACCOUNT_SUSPENSION,
      { reason, suspendedBy },
      context,
    );
  }

  async logAccountReactivation(
    userId: string,
    reactivatedBy: string,
    context?: AuditLogContext,
  ): Promise<AuditLog> {
    return this.log(
      userId,
      AuditAction.ACCOUNT_REACTIVATION,
      { reactivatedBy },
      context,
    );
  }

  // Role & Permission Actions
  async logRoleChange(
    userId: string,
    oldRole: string,
    newRole: string,
    changedBy: string,
    context?: AuditLogContext,
  ): Promise<AuditLog> {
    return this.log(
      userId,
      AuditAction.ROLE_CHANGE,
      { oldRole, newRole, changedBy },
      context,
    );
  }

  async logPermissionChange(
    userId: string,
    oldPermissions: string[],
    newPermissions: string[],
    changedBy: string,
    context?: AuditLogContext,
  ): Promise<AuditLog> {
    return this.log(
      userId,
      AuditAction.PERMISSION_CHANGE,
      { oldPermissions, newPermissions, changedBy },
      context,
    );
  }

  // Query Methods
  async findByUserId(
    userId: string,
    options?: {
      startDate?: Date;
      endDate?: Date;
      action?: AuditAction;
    },
  ): Promise<AuditLog[]> {
    const where: FindOptionsWhere<AuditLog> = { userId };

    if (options?.action) {
      where.action = options.action;
    }

    if (options?.startDate && options?.endDate) {
      where.timestamp = Between(options.startDate, options.endDate);
    }

    return this.auditLogRepository.find({
      where,
      order: { timestamp: 'DESC' },
    });
  }

  async findByAction(
    action: AuditAction,
    options?: {
      startDate?: Date;
      endDate?: Date;
    },
  ): Promise<AuditLog[]> {
    const where: FindOptionsWhere<AuditLog> = { action };

    if (options?.startDate && options?.endDate) {
      where.timestamp = Between(options.startDate, options.endDate);
    }

    return this.auditLogRepository.find({
      where,
      order: { timestamp: 'DESC' },
    });
  }

  async findByDateRange(
    startDate: Date,
    endDate: Date,
    options?: {
      action?: AuditAction;
      userId?: string;
    },
  ): Promise<AuditLog[]> {
    const where: FindOptionsWhere<AuditLog> = {
      timestamp: Between(startDate, endDate),
    };

    if (options?.action) {
      where.action = options.action;
    }

    if (options?.userId) {
      where.userId = options.userId;
    }

    return this.auditLogRepository.find({
      where,
      order: { timestamp: 'DESC' },
    });
  }
} 