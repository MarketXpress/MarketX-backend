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
        } catch (err) {
          this.logger.error(
            `Failed to anonymize user ${user.id}: ${err.message}`,
            err.stack,
          );
        }
      }

      this.logger.log(`PII purge complete. Anonymized ${toPurge.length} user(s).`);
    } catch (err) {
      this.logger.error('PII purge job failed', err.stack);
    }
  }

  /**
   * Overwrites all PII fields with anonymized placeholders.
   * Financial aggregates (totalSales, sellerRating, totalReviews) are preserved.
   */
  async anonymizeUser(user: Users): Promise<void> {
    user.email = `deleted_${user.id}@anonymized.local`;
    user.name = 'Deleted User';
    user.bio = null;
    user.avatarUrl = null;
    user.status = 'deleted';
    user.isActive = false;

    // Clear any nullable PII columns that exist on the entity
    if ('refreshToken' in user) {
      (user as any).refreshToken = null;
    }

    await this.userRepository.save(user);
  }
}
