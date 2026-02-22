import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { EmailService } from './email.service';
import { SendEmailDto } from './dto/send-email.dto';

@Processor('email')
export class EmailProcessor {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(private readonly emailService: EmailService) {}

  @Process('send-email')
  async handleSendEmail(job: Job<SendEmailDto>) {
    this.logger.debug(`Processing email job ${job.id} to ${job.data.to}`);
    
    try {
      await this.emailService.sendMail(job.data);
      this.logger.debug(`Email job ${job.id} completed successfully`);
    } catch (error) {
      this.logger.error(`Failed to process email job ${job.id}: ${error.message}`);
      throw error; // Re-throw to trigger Bull's retry logic
    }
  }
}
