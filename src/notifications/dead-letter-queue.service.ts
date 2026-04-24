/**
 * Dead Letter Queue (DLQ) Service
 * 
 * Handles routing failed jobs to dead-letter queues with metadata for triage.
 * Provides operational visibility for failed processing events.
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';

export interface DeadLetterEntry {
  id: string;
  eventType: string;
  domain: string;
  originalPayload: any;
  error: {
    message: string;
    stack?: string;
    name: string;
  };
  failureContext: {
    attempts: number;
    firstFailureAt: Date;
    lastFailureAt: Date;
    retryHistory: Array<{
      attemptNumber: number;
      timestamp: Date;
      error: string;
    }>;
  };
  metadata: {
    eventId?: string;
    correlationId?: string;
    sourceService?: string;
    [key: string]: any;
  };
  status: 'pending' | 'investigating' | 'resolved' | 'discarded';
  createdAt: Date;
  updatedAt: Date;
}

@Entity('dead_letter_queue')
export class DeadLetterQueueEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'event_type' })
  eventType: string;

  @Column()
  domain: string;

  @Column({ name: 'original_payload', type: 'json' })
  originalPayload: any;

  @Column({ type: 'json' })
  error: {
    message: string;
    stack?: string;
    name: string;
  };

  @Column({ name: 'failure_context', type: 'json' })
  failureContext: {
    attempts: number;
    firstFailureAt: Date;
    lastFailureAt: Date;
    retryHistory: Array<{
      attemptNumber: number;
      timestamp: Date;
      error: string;
    }>;
  };

  @Column({ type: 'json' })
  metadata: {
    eventId?: string;
    correlationId?: string;
    sourceService?: string;
    [key: string]: any;
  };

  @Column({
    type: 'varchar',
    length: 20,
    default: 'pending',
  })
  status: 'pending' | 'investigating' | 'resolved' | 'discarded';

  @Column({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}



@Injectable()
export class DeadLetterQueueService implements OnModuleInit {
  private readonly logger = new Logger(DeadLetterQueueService.name);
  private readonly dlqExchange = 'marketx.dlq';
  private readonly dlqRoutingKeyPrefix = 'dlq';

  constructor(
    @InjectRepository(DeadLetterQueueEntity)
    private readonly dlqRepository: Repository<DeadLetterQueueEntity>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  onModuleInit() {
    this.logger.log('Dead Letter Queue Service initialized');
  }

  /**
   * Route a failed event to the dead letter queue
   */
  async routeToDLQ(
    eventType: string,
    domain: string,
    originalPayload: any,
    error: Error,
    context: {
      attempts: number;
      retryHistory: Array<{
        attemptNumber: number;
        timestamp: Date;
        error: string;
      }>;
      eventId?: string;
      correlationId?: string;
      metadata?: Record<string, any>;
    },
  ): Promise<DeadLetterEntry> {
    try {
      const entry = this.dlqRepository.create({
        eventType,
        domain,
        originalPayload,
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name,
        },
        failureContext: {
          attempts: context.attempts,
          firstFailureAt: context.retryHistory[0]?.timestamp || new Date(),
          lastFailureAt: new Date(),
          retryHistory: context.retryHistory,
        },
        metadata: {
          eventId: context.eventId,
          correlationId: context.correlationId,
          sourceService: 'marketx-backend',
          ...context.metadata,
        },
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const saved = await this.dlqRepository.save(entry);

      this.logger.warn(
        `Event routed to DLQ: ${eventType} (attempts: ${context.attempts})`,
        {
          eventType,
          domain,
          attempts: context.attempts,
          error: error.message,
          dlqEntryId: saved.id,
        },
      );

      // Emit DLQ event for monitoring systems
      this.eventEmitter.emit('dlq.entry.created', {
        dlqEntryId: saved.id,
        eventType,
        domain,
        attempts: context.attempts,
        error: error.message,
        timestamp: new Date(),
      });

      return saved;
    } catch (dlqError) {
      this.logger.error(
        `Failed to save entry to DLQ: ${eventType}`,
        dlqError instanceof Error ? dlqError : new Error(String(dlqError)),
      );
      throw dlqError;
    }
  }

  /**
   * Get DLQ entries with filtering and pagination
   */
  async getDLQEntries(options?: {
    status?: string;
    domain?: string;
    eventType?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ entries: DeadLetterEntry[]; total: number }> {
    const queryBuilder = this.dlqRepository.createQueryBuilder('dlq');

    if (options?.status) {
      queryBuilder.andWhere('dlq.status = :status', { status: options.status });
    }

    if (options?.domain) {
      queryBuilder.andWhere('dlq.domain = :domain', { domain: options.domain });
    }

    if (options?.eventType) {
      queryBuilder.andWhere('dlq.eventType = :eventType', {
        eventType: options.eventType,
      });
    }

    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    queryBuilder
      .orderBy('dlq.createdAt', 'DESC')
      .limit(limit)
      .offset(offset);

    const [entries, total] = await queryBuilder.getManyAndCount();

    return { entries, total };
  }

  /**
   * Get a single DLQ entry by ID
   */
  async getDLQEntry(id: string): Promise<DeadLetterEntry | null> {
    return this.dlqRepository.findOne({ where: { id } });
  }

  /**
   * Update DLQ entry status
   */
  async updateDLQEntryStatus(
    id: string,
    status: 'pending' | 'investigating' | 'resolved' | 'discarded',
    metadata?: Record<string, any>,
  ): Promise<DeadLetterEntry> {
    const entry = await this.dlqRepository.findOne({ where: { id } });

    if (!entry) {
      throw new Error(`DLQ entry not found: ${id}`);
    }

    entry.status = status;
    entry.updatedAt = new Date();

    if (metadata) {
      entry.metadata = { ...entry.metadata, ...metadata };
    }

    const updated = await this.dlqRepository.save(entry);

    this.logger.log(`DLQ entry ${id} status updated to ${status}`);

    this.eventEmitter.emit('dlq.entry.status_changed', {
      dlqEntryId: id,
      previousStatus: status,
      newStatus: status,
      timestamp: new Date(),
    });

    return updated;
  }

  /**
   * Retry a DLQ entry (re-publish the event)
   */
  async retryDLQEntry(id: string): Promise<boolean> {
    const entry = await this.dlqRepository.findOne({ where: { id } });

    if (!entry) {
      throw new Error(`DLQ entry not found: ${id}`);
    }

    if (entry.status === 'resolved') {
      this.logger.warn(`Cannot retry resolved DLQ entry: ${id}`);
      return false;
    }

    this.logger.log(`Retrying DLQ entry: ${id} (${entry.eventType})`);

    // Update status to investigating
    entry.status = 'investigating';
    entry.updatedAt = new Date();
    entry.metadata = {
      ...entry.metadata,
      lastRetryAt: new Date(),
      retryCount: (entry.metadata.retryCount || 0) + 1,
    };

    await this.dlqRepository.save(entry);

    // Emit retry event for event processors to handle
    this.eventEmitter.emit('dlq.entry.retry', {
      dlqEntryId: id,
      eventType: entry.eventType,
      domain: entry.domain,
      payload: entry.originalPayload,
      retryCount: entry.metadata.retryCount,
      timestamp: new Date(),
    });

    return true;
  }

  /**
   * Delete a DLQ entry (after resolution or if it's no longer needed)
   */
  async deleteDLQEntry(id: string): Promise<void> {
    const result = await this.dlqRepository.delete(id);

    if ((result as any).affected === 0) {
      throw new Error(`DLQ entry not found: ${id}`);
    }

    this.logger.log(`DLQ entry deleted: ${id}`);

    this.eventEmitter.emit('dlq.entry.deleted', {
      dlqEntryId: id,
      timestamp: new Date(),
    });
  }

  /**
   * Get DLQ statistics
   */
  async getDLQStats(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byDomain: Record<string, number>;
    byEventType: Record<string, number>;
    olderThan24h: number;
    olderThan7d: number;
  }> {
    const total = await this.dlqRepository.count();

    const byStatus = await this.dlqRepository
      .createQueryBuilder('dlq')
      .select('dlq.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('dlq.status')
      .getRawMany();

    const byDomain = await this.dlqRepository
      .createQueryBuilder('dlq')
      .select('dlq.domain', 'domain')
      .addSelect('COUNT(*)', 'count')
      .groupBy('dlq.domain')
      .getRawMany();

    const byEventType = await this.dlqRepository
      .createQueryBuilder('dlq')
      .select('dlq.eventType', 'eventType')
      .addSelect('COUNT(*)', 'count')
      .groupBy('dlq.eventType')
      .getRawMany();

    const now = new Date();
    const olderThan24h = await this.dlqRepository
      .createQueryBuilder('dlq')
      .where('dlq.createdAt < :threshold', {
        threshold: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      })
      .getCount();

    const olderThan7d = await this.dlqRepository
      .createQueryBuilder('dlq')
      .where('dlq.createdAt < :threshold', {
        threshold: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      })
      .getCount();

    return {
      total,
      byStatus: this.reduceCount(byStatus),
      byDomain: this.reduceCount(byDomain),
      byEventType: this.reduceCount(byEventType),
      olderThan24h,
      olderThan7d,
    };
  }

  /**
   * Cleanup old resolved DLQ entries (cron job)
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupOldDLQEntries(): Promise<void> {
    const retentionDays = 30;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await this.dlqRepository
      .createQueryBuilder()
      .delete()
      .from(DeadLetterQueueEntity)
      .where('status IN (:...statuses)', {
        statuses: ['resolved', 'discarded'],
      })
      .andWhere('created_at < :cutoffDate', { cutoffDate })
      .execute();

    const deletedCount = (result as any).affected || 0;

    this.logger.log(
      `Cleaned up ${deletedCount} old DLQ entries (older than ${retentionDays} days)`,
    );

    if (deletedCount > 0) {
      this.eventEmitter.emit('dlq.cleanup.completed', {
        deletedCount,
        retentionDays,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Helper to reduce query results to a count map
   */
  private reduceCount(results: Array<{ count: string } & Record<string, any>>): Record<string, number> {
    return results.reduce((acc, row) => {
      const key = Object.keys(row).find(k => k !== 'count')!;
      acc[row[key]] = parseInt(row.count, 10);
      return acc;
    }, {} as Record<string, number>);
  }
}
