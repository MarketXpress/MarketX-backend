import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';

import {
  PIIDataType,
  PIIRetentionRule,
  PIIRetentionSchedule,
  PurgeMethod,
  PII_RETENTION_POLICY,
  PII_RETENTION_SCHEDULES,
} from '../pii-retention-policy';
import { User } from '../../entities/user.entity';
import { NotificationService } from '../../notifications/notifications.service';
import { RedisCacheService } from '../../redis-caching/redis-cache.service';

export interface PIIPurgeRecord {
  id: string;
  userId: string;
  dataType: PIIDataType;
  originalValue: string;
  purgeMethod: PurgeMethod;
  purgedAt: Date;
  purgedBy: string;
  legalHoldId?: string;
  retentionTrigger: string;
}

@Injectable()
export class PIIRetentionService {
  private readonly logger = new Logger(PIIRetentionService.name);
  private readonly cachePrefix = 'pii_retention:';
  private readonly legalHoldCachePrefix = 'legal_hold:';

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly notificationService: NotificationService,
    private readonly redisCache: RedisCacheService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Daily cron job to process PII retention for all data types
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async processDailyPIIRetention(): Promise<void> {
    this.logger.log('Starting daily PII retention processing');

    const results = await Promise.allSettled(
      Object.values(PIIDataType).map((dataType) =>
        this.processPIIRetentionForType(dataType),
      ),
    );

    const failures = results.filter((result) => result.status === 'rejected');
    if (failures.length > 0) {
      this.logger.error(`Failed to process ${failures.length} PII data types`);
      await this.notifyComplianceTeam(failures);
    }

    this.logger.log('Completed daily PII retention processing');
  }

  /**
   * Process PII retention for a specific data type
   */
  async processPIIRetentionForType(dataType: PIIDataType): Promise<void> {
    const schedule = PII_RETENTION_SCHEDULES[dataType];
    const rule = PII_RETENTION_POLICY[dataType];

    this.logger.debug(`Processing PII retention for ${dataType}`);

    try {
      const recordsToPurge = await this.findRecordsForPurge(dataType, rule);

      if (recordsToPurge.length === 0) {
        this.logger.debug(`No records to purge for ${dataType}`);
        return;
      }

      this.logger.info(
        `Found ${recordsToPurge.length} records to purge for ${dataType}`,
      );

      // Process in batches
      for (let i = 0; i < recordsToPurge.length; i += schedule.batchSize) {
        const batch = recordsToPurge.slice(i, i + schedule.batchSize);
        await this.processBatch(batch, dataType, rule);

        // Add delay between batches to prevent database overload
        if (i + schedule.batchSize < recordsToPurge.length) {
          await this.delay(schedule.retryDelayMinutes * 60 * 1000);
        }
      }

      this.logger.info(
        `Successfully processed ${recordsToPurge.length} records for ${dataType}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to process PII retention for ${dataType}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Find records that need to be purged based on retention rules
   */
  private async findRecordsForPurge(
    dataType: PIIDataType,
    rule: PIIRetentionRule,
  ): Promise<any[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - rule.retentionPeriodDays);

    switch (dataType) {
      case PIIDataType.EMAIL:
        return this.findEmailsForPurge(cutoffDate, rule);
      case PIIDataType.PHONE:
        return this.findPhoneNumbersForPurge(cutoffDate, rule);
      case PIIDataType.NAME:
        return this.findNamesForPurge(cutoffDate, rule);
      case PIIDataType.IP_ADDRESS:
        return this.findIPAddressesForPurge(cutoffDate, rule);
      case PIIDataType.FINANCIAL_DATA:
        return this.findFinancialDataForPurge(cutoffDate, rule);
      case PIIDataType.COMMUNICATION_PREFERENCES:
        return this.findCommunicationPreferencesForPurge(cutoffDate, rule);
      default:
        this.logger.warn(`No purge implementation for data type: ${dataType}`);
        return [];
    }
  }

  private async findEmailsForPurge(
    cutoffDate: Date,
    rule: PIIRetentionRule,
  ): Promise<User[]> {
    const queryBuilder = this.userRepository
      .createQueryBuilder('user')
      .where('user.createdAt < :cutoffDate', { cutoffDate })
      .andWhere('user.status IN (:...statuses)', {
        statuses: ['inactive', 'deleted', 'suspended'],
      });

    // Exclude users with legal holds
    if (rule.requiresLegalHold) {
      const usersWithLegalHolds = await this.getUsersWithLegalHolds(
        PIIDataType.EMAIL,
      );
      if (usersWithLegalHolds.length > 0) {
        queryBuilder.andWhere('user.id NOT IN (:...legalHoldUsers)', {
          legalHoldUsers: usersWithLegalHolds,
        });
      }
    }

    return queryBuilder.getMany();
  }

  private async findPhoneNumbersForPurge(
    cutoffDate: Date,
    rule: PIIRetentionRule,
  ): Promise<User[]> {
    return this.userRepository
      .createQueryBuilder('user')
      .where('user.createdAt < :cutoffDate', { cutoffDate })
      .andWhere('user.phoneNumber IS NOT NULL')
      .andWhere('user.status IN (:...statuses)', {
        statuses: ['inactive', 'deleted', 'suspended'],
      })
      .getMany();
  }

  private async findNamesForPurge(
    cutoffDate: Date,
    rule: PIIRetentionRule,
  ): Promise<User[]> {
    return this.userRepository
      .createQueryBuilder('user')
      .where('user.deletedAt < :cutoffDate', { cutoffDate })
      .andWhere('user.deletedAt IS NOT NULL')
      .getMany();
  }

  private async findIPAddressesForPurge(
    cutoffDate: Date,
    rule: PIIRetentionRule,
  ): Promise<any[]> {
    // This would query audit logs or IP tracking tables
    const query = `
      SELECT id, user_id, ip_address, created_at 
      FROM user_login_logs 
      WHERE created_at < $1 
      AND ip_address IS NOT NULL
      LIMIT 1000
    `;

    return this.dataSource.query(query, [cutoffDate]);
  }

  private async findFinancialDataForPurge(
    cutoffDate: Date,
    rule: PIIRetentionRule,
  ): Promise<any[]> {
    // This would query transaction records, payment methods, etc.
    const query = `
      SELECT id, user_id, payment_method, amount, created_at 
      FROM financial_records 
      WHERE created_at < $1 
      AND archived = false
      LIMIT 100
    `;

    return this.dataSource.query(query, [cutoffDate]);
  }

  private async findCommunicationPreferencesForPurge(
    cutoffDate: Date,
    rule: PIIRetentionRule,
  ): Promise<any[]> {
    const query = `
      SELECT id, user_id, email_preferences, sms_preferences, updated_at 
      FROM communication_preferences 
      WHERE updated_at < $1 
      AND consent_withdrawn = true
      LIMIT 2000
    `;

    return this.dataSource.query(query, [cutoffDate]);
  }

  /**
   * Process a batch of records for purging
   */
  private async processBatch(
    records: any[],
    dataType: PIIDataType,
    rule: PIIRetentionRule,
  ): Promise<void> {
    const purgeRecords: PIIPurgeRecord[] = [];

    for (const record of records) {
      try {
        const purgeRecord = await this.purgeRecord(record, dataType, rule);
        if (purgeRecord) {
          purgeRecords.push(purgeRecord);
        }
      } catch (error) {
        this.logger.error(`Failed to purge record ${record.id}:`, error);
      }
    }

    // Log all purged records for audit
    if (purgeRecords.length > 0) {
      await this.logPurgeRecords(purgeRecords);
    }
  }

  /**
   * Purge a single record based on the specified method
   */
  private async purgeRecord(
    record: any,
    dataType: PIIDataType,
    rule: PIIRetentionRule,
  ): Promise<PIIPurgeRecord | null> {
    const originalValue = this.extractPIIValue(record, dataType);
    if (!originalValue) return null;

    const purgeRecord: PIIPurgeRecord = {
      id: `purge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: record.user_id || record.id,
      dataType,
      originalValue,
      purgeMethod: rule.purgeMethod,
      purgedAt: new Date(),
      purgedBy: 'pii_retention_service',
      retentionTrigger: rule.retentionTrigger,
    };

    switch (rule.purgeMethod) {
      case PurgeMethod.SOFT_DELETE:
        return await this.softDeleteRecord(record, dataType, purgeRecord);
      case PurgeMethod.ANONYMIZE:
        return await this.anonymizeRecord(record, dataType, purgeRecord);
      case PurgeMethod.SECURE_DELETE:
        return await this.secureDeleteRecord(record, dataType, purgeRecord);
      case PurgeMethod.ARCHIVE_THEN_DELETE:
        return await this.archiveAndDeleteRecord(record, dataType, purgeRecord);
      default:
        this.logger.warn(`Unknown purge method: ${rule.purgeMethod}`);
        return null;
    }
  }

  private extractPIIValue(record: any, dataType: PIIDataType): string {
    switch (dataType) {
      case PIIDataType.EMAIL:
        return record.email;
      case PIIDataType.PHONE:
        return record.phoneNumber;
      case PIIDataType.NAME:
        return `${record.firstName} ${record.lastName}`;
      case PIIDataType.IP_ADDRESS:
        return record.ip_address;
      case PIIDataType.FINANCIAL_DATA:
        return JSON.stringify({
          paymentMethod: record.payment_method,
          amount: record.amount,
        });
      case PIIDataType.COMMUNICATION_PREFERENCES:
        return JSON.stringify({
          email: record.email_preferences,
          sms: record.sms_preferences,
        });
      default:
        return '';
    }
  }

  private async softDeleteRecord(
    record: any,
    dataType: PIIDataType,
    purgeRecord: PIIPurgeRecord,
  ): Promise<PIIPurgeRecord> {
    switch (dataType) {
      case PIIDataType.EMAIL:
        await this.userRepository.update(record.id, {
          email: `deleted_${record.id}@deleted.local`,
          status: 'deleted',
        });
        break;
      case PIIDataType.PHONE:
        await this.userRepository.update(record.id, {
          phoneNumber: null,
        });
        break;
      default:
        this.logger.warn(`Soft delete not implemented for ${dataType}`);
    }

    return purgeRecord;
  }

  private async anonymizeRecord(
    record: any,
    dataType: PIIDataType,
    purgeRecord: PIIPurgeRecord,
  ): Promise<PIIPurgeRecord> {
    const anonymizedValue = this.generateAnonymizedValue(dataType);

    switch (dataType) {
      case PIIDataType.EMAIL:
        await this.userRepository.update(record.id, {
          email: anonymizedValue,
        });
        break;
      case PIIDataType.PHONE:
        await this.userRepository.update(record.id, {
          phoneNumber: anonymizedValue,
        });
        break;
      case PIIDataType.NAME:
        await this.userRepository.update(record.id, {
          firstName: 'Anonymous',
          lastName: 'User',
        });
        break;
      default:
        this.logger.warn(`Anonymization not implemented for ${dataType}`);
    }

    return purgeRecord;
  }

  private async secureDeleteRecord(
    record: any,
    dataType: PIIDataType,
    purgeRecord: PIIPurgeRecord,
  ): Promise<PIIPurgeRecord> {
    switch (dataType) {
      case PIIDataType.IP_ADDRESS:
        await this.dataSource.query(
          'DELETE FROM user_login_logs WHERE id = $1',
          [record.id],
        );
        break;
      case PIIDataType.COMMUNICATION_PREFERENCES:
        await this.dataSource.query(
          'DELETE FROM communication_preferences WHERE id = $1',
          [record.id],
        );
        break;
      default:
        this.logger.warn(`Secure delete not implemented for ${dataType}`);
    }

    return purgeRecord;
  }

  private async archiveAndDeleteRecord(
    record: any,
    dataType: PIIDataType,
    purgeRecord: PIIPurgeRecord,
  ): Promise<PIIPurgeRecord> {
    // First archive the record
    await this.archiveRecord(record, dataType, purgeRecord);

    // Then delete the original
    await this.secureDeleteRecord(record, dataType, purgeRecord);

    return purgeRecord;
  }

  private async archiveRecord(
    record: any,
    dataType: PIIDataType,
    purgeRecord: PIIPurgeRecord,
  ): Promise<void> {
    const archiveData = {
      originalRecord: record,
      purgeRecord,
      archivedAt: new Date(),
    };

    // Store in archive table (implementation depends on your archive strategy)
    await this.dataSource.query(
      'INSERT INTO pii_archive (data_type, user_id, archive_data, archived_at) VALUES ($1, $2, $3, $4)',
      [
        dataType,
        record.user_id || record.id,
        JSON.stringify(archiveData),
        new Date(),
      ],
    );
  }

  private generateAnonymizedValue(dataType: PIIDataType): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);

    switch (dataType) {
      case PIIDataType.EMAIL:
        return `anonymous_${timestamp}_${random}@anonymized.local`;
      case PIIDataType.PHONE:
        return `+1${timestamp.toString().slice(-10)}`;
      default:
        return `anonymous_${timestamp}_${random}`;
    }
  }

  private async logPurgeRecords(purgeRecords: PIIPurgeRecord[]): Promise<void> {
    try {
      for (const record of purgeRecords) {
        await this.dataSource.query(
          `INSERT INTO pii_purge_log 
           (id, user_id, data_type, original_value, purge_method, purged_at, purged_by, retention_trigger) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            record.id,
            record.userId,
            record.dataType,
            record.originalValue,
            record.purgeMethod,
            record.purgedAt,
            record.purgedBy,
            record.retentionTrigger,
          ],
        );
      }

      this.logger.info(`Logged ${purgeRecords.length} purge records`);
    } catch (error) {
      this.logger.error('Failed to log purge records:', error);
    }
  }

  private async getUsersWithLegalHolds(
    dataType: PIIDataType,
  ): Promise<string[]> {
    const cacheKey = `${this.legalHoldCachePrefix}${dataType}`;
    const cached = await this.redisCache.get<string[]>(cacheKey);

    if (cached) {
      return cached;
    }

    const query = `
      SELECT DISTINCT user_id 
      FROM legal_holds 
      WHERE data_type = $1 
      AND is_active = true 
      AND (expires_at IS NULL OR expires_at > NOW())
    `;

    const result = await this.dataSource.query(query, [dataType]);
    const userIds = result.map((row: any) => row.user_id);

    // Cache for 1 hour
    await this.redisCache.set(cacheKey, userIds, 3600);

    return userIds;
  }

  private async notifyComplianceTeam(failures: any[]): Promise<void> {
    const failureDetails = failures.map((failure, index) => ({
      index: index + 1,
      error: failure.reason?.message || 'Unknown error',
      dataType: failure.reason?.dataType || 'Unknown',
    }));

    try {
      await this.notificationService.createNotification({
        userId: 'compliance_team',
        type: 'pii_retention_failure',
        title: 'PII Retention Processing Failures',
        message: `${failures.length} data types failed to process during PII retention`,
        metadata: {
          failures: failureDetails,
          timestamp: new Date(),
        },
      });

      this.logger.info('Notified compliance team about PII retention failures');
    } catch (error) {
      this.logger.error('Failed to notify compliance team:', error);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Manual trigger for PII retention processing (for testing or manual runs)
   */
  async triggerManualPIIRetention(dataType?: PIIDataType): Promise<void> {
    if (dataType) {
      await this.processPIIRetentionForType(dataType);
    } else {
      await this.processDailyPIIRetention();
    }
  }

  /**
   * Get PII retention statistics
   */
  async getRetentionStatistics(): Promise<any> {
    const stats = {};

    for (const dataType of Object.values(PIIDataType)) {
      const rule = PII_RETENTION_POLICY[dataType];
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - rule.retentionPeriodDays);

      const pendingCount = await this.getPendingPurgeCount(
        dataType,
        cutoffDate,
      );
      const legalHoldCount = await this.getUsersWithLegalHolds(dataType);

      stats[dataType] = {
        retentionPeriodDays: rule.retentionPeriodDays,
        purgeMethod: rule.purgeMethod,
        pendingPurgeCount: pendingCount,
        legalHoldCount: legalHoldCount.length,
        nextScheduledRun: new Date(
          Date.now() +
            PII_RETENTION_SCHEDULES[dataType].checkIntervalHours *
              60 *
              60 *
              1000,
        ),
      };
    }

    return stats;
  }

  private async getPendingPurgeCount(
    dataType: PIIDataType,
    cutoffDate: Date,
  ): Promise<number> {
    // Implementation depends on specific data type queries
    // This is a simplified version
    try {
      const records = await this.findRecordsForPurge(
        dataType,
        PII_RETENTION_POLICY[dataType],
      );
      return records.length;
    } catch (error) {
      this.logger.error(
        `Failed to get pending purge count for ${dataType}:`,
        error,
      );
      return 0;
    }
  }
}
