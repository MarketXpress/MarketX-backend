import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import {
  IMAGE_JOB_PROCESS,
  IMAGE_PROCESSING_QUEUE,
} from '../job-processing/queue.constants';
import { ImageProcessingJobData } from './media.jobs';
import { MediaService } from './media.service';

@Processor(IMAGE_PROCESSING_QUEUE)
export class MediaProcessor {
  private readonly logger = new Logger(MediaProcessor.name);

  constructor(private readonly mediaService: MediaService) {}

  @Process(IMAGE_JOB_PROCESS)
  async handleImageProcessing(job: Job<ImageProcessingJobData>) {
    this.logger.debug(
      `Processing image job ${job.id} for product ${job.data.productId}`,
    );

    await this.mediaService.processQueuedImage(job.data);
  }
}
