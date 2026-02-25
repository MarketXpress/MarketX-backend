import { Process, Processor, OnQueueFailed, OnQueueCompleted } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { EmailService } from './email.service';
import { SendEmailDto } from './dto/send-email.dto';

@Processor('email')
export class EmailProcessor {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(private readonly emailService: EmailService) { }

  @Process('send-email')
  async handleSendEmail(job: Job<SendEmailDto & { logId?: string }>) {
    this.logger.debug(
      `Processing email job ${job.id} | to: ${job.data.to} | template: ${job.data.template} | attempt: ${job.attemptsMade + 1}`,
    );

    await this.emailService.sendMail(job.data);
  }

  @OnQueueCompleted()
  onCompleted(job: Job) {
    this.logger.debug(`Email job ${job.id} completed successfully after ${job.attemptsMade + 1} attempt(s).`);
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error) {
    this.logger.error(
      `Email job ${job.id} failed after ${job.attemptsMade} attempt(s). ` +
      `Recipient: ${job.data?.to} | Template: ${job.data?.template} | Error: ${error.message}`,
    );
  }
}
