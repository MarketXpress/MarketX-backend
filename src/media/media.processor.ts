import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import {
  IMAGE_JOB_PROCESS,
  IMAGE_PROCESSING_QUEUE,
} from '../job-processing/queue.constants';
import { ImageProcessingJobData } from './media.jobs';
import { MediaService } from './media.service';
import { IdempotencyService } from '../common/idempotency/idempotency.service';

@Processor(IMAGE_PROCESSING_QUEUE)
export class MediaProcessor {
  private readonly logger = new Logger(MediaProcessor.name);

  constructor(
    private readonly mediaService: MediaService,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  @Process(IMAGE_JOB_PROCESS)
  async handleImageProcessing(job: Job<ImageProcessingJobData>) {
    const dedupKey =
      (job.data as any).idempotencyKey ||
      `image-job:${job.data.productId}:${job.data.file.originalname}:${job.data.displayOrder}`;

    const guarded = await this.idempotencyService.executeOnce(
      dedupKey,
      async () => {
        this.logger.debug(
          `Processing image job ${job.id} for product ${job.data.productId}`,
        );

        await this.mediaService.processQueuedImage(job.data);
      },
      24 * 60 * 60,
    );

    if (!guarded.executed) {
      this.logger.warn(`Skipping duplicate image processing side effect for key ${dedupKey}`);
    }
  }
}
