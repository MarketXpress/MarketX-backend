import {
  Process,
  Processor,
  OnQueueFailed,
  OnQueueCompleted,
} from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { EmailService } from './email.service';
import { SendEmailDto } from './dto/send-email.dto';
import { EMAIL_JOB_SEND, EMAIL_QUEUE } from '../job-processing/queue.constants';
import { IdempotencyService } from '../common/idempotency/idempotency.service';

@Processor(EMAIL_QUEUE)
export class EmailProcessor {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  @Process(EMAIL_JOB_SEND)
  async handleSendEmail(job: Job<SendEmailDto & { logId?: string }>) {
    const dedupKey =
      (job.data as any).idempotencyKey ||
      `email-job:${job.id}:${job.data.to}:${job.data.template}`;

    const guarded = await this.idempotencyService.executeOnce(
      dedupKey,
      async () => {
        this.logger.debug(
          `Processing email job ${job.id} | to: ${job.data.to} | template: ${job.data.template} | attempt: ${job.attemptsMade + 1}`,
        );

        await this.emailService.sendMail(job.data);
      },
      24 * 60 * 60,
    );

    if (!guarded.executed) {
      this.logger.warn(`Skipping duplicate email side effect for key ${dedupKey}`);
    }
  }

  @OnQueueCompleted()
  onCompleted(job: Job) {
    this.logger.debug(
      `Email job ${job.id} completed successfully after ${job.attemptsMade + 1} attempt(s).`,
    );
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error) {
    this.logger.error(
      `Email job ${job.id} failed after ${job.attemptsMade} attempt(s). ` +
        `Recipient: ${job.data?.to} | Template: ${job.data?.template} | Error: ${error.message}`,
    );
  }
}
