import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Listing } from '../listing/entities/listing.entity';

@Injectable()
export class ExpireListingsTask {
  private readonly logger = new Logger(ExpireListingsTask.name);

  constructor(
    @InjectRepository(Listing)
    private readonly listingRepo: Repository<Listing>,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleCron() {
    this.logger.log('Checking for expired listings...');
    try {
      const now = new Date();
      const expiredListings = await this.listingRepo.find({
        where: {
          isActive: true,
          expiresAt: LessThan(now),
        },
      });
      if (expiredListings.length > 0) {
        for (const listing of expiredListings) {
          listing.isActive = false;
          await this.listingRepo.save(listing);
        }
        this.logger.log(`Marked ${expiredListings.length} listings as expired.`);
      } else {
        this.logger.log('No listings to expire.');
      }
    } catch (error) {
      this.logger.error('Failed to expire listings', error.stack || error.message);
    }
  }
} 