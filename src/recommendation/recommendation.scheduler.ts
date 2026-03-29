import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Cron } from '@nestjs/schedule';
import { Queue } from 'bull';
import {
  RECOMMENDATIONS_JOB_REFRESH,
  RECOMMENDATIONS_QUEUE,
} from '../job-processing/queue.constants';
import { RecommendationsService } from './recommendation.service';

@Injectable()
export class RecommendationScheduler {
  private readonly logger = new Logger(RecommendationScheduler.name);

  constructor(
    @InjectQueue(RECOMMENDATIONS_QUEUE)
    private readonly recommendationsQueue: Queue,
    private readonly recommendationsService: RecommendationsService,
  ) {}

  @Cron('0 3 * * *', { timeZone: 'UTC' })
  async refreshNightlyRecommendations(): Promise<void> {
    const userIds = await this.recommendationsService.getUsersNeedingRefresh();

    for (const userId of userIds) {
      await this.recommendationsQueue.add(RECOMMENDATIONS_JOB_REFRESH, {
        userId,
        limit: 100,
      });
    }

    this.logger.log(
      `Queued nightly recommendation refresh for ${userIds.length} users`,
    );
  }
}
