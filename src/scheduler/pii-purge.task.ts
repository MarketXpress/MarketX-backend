import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { Users } from '../users/users.entity';

/** Number of days after soft-deletion before PII is permanently anonymized. */
export const PII_GRACE_PERIOD_DAYS = 30;

@Injectable()
export class PiiPurgeTask {
  private readonly logger = new Logger(PiiPurgeTask.name);

  constructor(
    @InjectRepository(Users)
    private readonly userRepository: Repository<Users>,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handlePiiPurge(): Promise<void> {
    this.logger.log('Starting PII purge for users past grace period...');

    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - PII_GRACE_PERIOD_DAYS);

      // withDeleted: true so TypeORM includes soft-deleted rows
      const eligibleUsers = await this.userRepository.find({
        where: { deletedAt: LessThan(cutoff) },
        withDeleted: true,
      });

      // Filter out already-anonymized rows (email starts with 'deleted_')
      const toPurge = eligibleUsers.filter(
        (u) => u.email && !u.email.startsWith('deleted_'),
      );

      if (toPurge.length === 0) {
        this.logger.log('No users required PII purging.');
        return;
      }

      for (const user of toPurge) {
        try {
          await this.anonymizeUser(user);
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          const stack = err instanceof Error ? err.stack : undefined;
          this.logger.error(
            `Failed to anonymize user ${user.id}: ${message}`,
            stack,
          );
        }
      }

      this.logger.log(
        `PII purge complete. Anonymized ${toPurge.length} user(s).`,
      );
    } catch (err: unknown) {
      const stack = err instanceof Error ? err.stack : String(err);
      this.logger.error('PII purge job failed', stack);
    }
  }

  /**
   * Overwrites all PII fields with anonymized placeholders.
   * Financial aggregates (trustScore, isVerifiedSeller, etc.) are preserved.
   */
  async anonymizeUser(user: Users): Promise<void> {
    user.email = `deleted_${user.id}@anonymized.local`;
    user.name = 'Deleted User';
    user.bio = '';
    user.avatarUrl = '';
    user.status = 'deleted';
    user.isActive = false;

    // Clear refreshToken if present on the entity
    if ('refreshToken' in user) {
      (user as any).refreshToken = '';
    }

    await this.userRepository.save(user);
  }
}
