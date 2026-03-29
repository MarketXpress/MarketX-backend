import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import {
  RECOMMENDATIONS_JOB_REFRESH,
  RECOMMENDATIONS_QUEUE,
} from '../job-processing/queue.constants';
import { RefreshUserRecommendationsJobData } from './recommendation.jobs';
import { RecommendationsService } from './recommendation.service';

@Processor(RECOMMENDATIONS_QUEUE)
export class RecommendationProcessor {
  private readonly logger = new Logger(RecommendationProcessor.name);

  constructor(
    private readonly recommendationsService: RecommendationsService,
  ) {}

  @Process(RECOMMENDATIONS_JOB_REFRESH)
  async refreshUserRecommendations(
    job: Job<RefreshUserRecommendationsJobData>,
  ): Promise<void> {
    this.logger.debug(
      `Refreshing recommendations for user ${job.data.userId} with limit ${job.data.limit}`,
    );

    await this.recommendationsService.precomputeRecommendations(
      job.data.userId,
      job.data.limit,
    );
  }
}
