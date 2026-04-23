import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Queue } from 'bull';
import * as sgMail from '@sendgrid/mail';
import * as handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';

import { SendEmailDto } from './dto/send-email.dto';
import { OrderConfirmationEmailDto } from './dto/order-confirmation-email.dto';
import { PasswordResetEmailDto } from './dto/password-reset-email.dto';
import { ShippingUpdateEmailDto } from './dto/shipping-update-email.dto';
import { WelcomeEmailDto } from './dto/welcome-email.dto';
import { EmailLog, EmailStatus } from './entities/email-log.entity';
import { EmailPreferenceService } from './email-preference.service';
import { SendGridWebhookEventDto } from './dto/webhook-event.dto';
import { AccountLockedEmailDto } from './dto/account-locked-email.dto';
import { EMAIL_JOB_SEND, EMAIL_QUEUE } from '../job-processing/queue.constants';

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private readonly templatesPath = path.join(__dirname, 'templates');

  constructor(
    private readonly configService: ConfigService,
    private readonly emailPreferenceService: EmailPreferenceService,
    @InjectQueue(EMAIL_QUEUE) private readonly emailQueue: Queue,
    @InjectRepository(EmailLog)
    private readonly emailLogRepository: Repository<EmailLog>,
  ) {}

  onModuleInit() {
    const apiKey = this.configService.get<string>('SENDGRID_API_KEY');
    if (apiKey) {
      sgMail.setApiKey(apiKey);
      this.logger.log('SendGrid API initialized');
    } else {
      this.logger.warn(
        'SENDGRID_API_KEY not found — email service running in dry-run/log-only mode.',
      );
    }
  }

  // ── Typed helpers ──────────────────────────────────────────────────────────

  async sendOrderConfirmation(dto: OrderConfirmationEmailDto): Promise<void> {
    if (dto.userId) {
      const allowed = await this.emailPreferenceService.canReceive(
        dto.userId,
        'order',
      );
      if (!allowed) {
        this.logger.debug(
          `User ${dto.userId} opted out of order emails — skipping.`,
        );
        return;
      }
    }

    await this.queueEmail({
      userId: dto.userId,
      to: dto.to,
      subject: `Your MarketX Order #${dto.orderNumber} is Confirmed!`,
      template: 'order-confirmation',
      context: {
        name: dto.name,
        orderId: dto.orderId,
        orderNumber: dto.orderNumber,
        total: dto.total.toFixed(2),
        currency: dto.currency,
        items: dto.items,
        trackingUrl: dto.trackingUrl,
      },
    });
  }

  async sendPasswordReset(dto: PasswordResetEmailDto): Promise<void> {
    // Security emails always send regardless of preferences
    await this.queueEmail({
      userId: dto.userId,
      to: dto.to,
      subject: 'Reset Your MarketX Password',
      template: 'password-reset',
      context: {
        name: dto.name,
        resetUrl: dto.resetUrl,
        expiryTime: dto.expiryTime,
      },
    });
  }

  async sendShippingUpdate(dto: ShippingUpdateEmailDto): Promise<void> {
    if (dto.userId) {
      const allowed = await this.emailPreferenceService.canReceive(
        dto.userId,
        'shipping',
      );
      if (!allowed) {
        this.logger.debug(
          `User ${dto.userId} opted out of shipping emails — skipping.`,
        );
        return;
      }
    }

    await this.queueEmail({
      userId: dto.userId,
      to: dto.to,
      subject: `Your Order #${dto.orderNumber} Has Shipped!`,
      template: 'shipping-update',
      context: {
        name: dto.name,
        orderId: dto.orderId,
        orderNumber: dto.orderNumber,
        trackingNumber: dto.trackingNumber,
        carrier: dto.carrier,
        trackingUrl: dto.trackingUrl,
        estimatedDelivery: dto.estimatedDelivery ?? 'See carrier site',
      },
    });
  }

  async sendWelcome(dto: WelcomeEmailDto): Promise<void> {
    if (dto.userId) {
      const allowed = await this.emailPreferenceService.canReceive(
        dto.userId,
        'account',
      );
      if (!allowed) {
        this.logger.debug(
          `User ${dto.userId} opted out of account emails — skipping.`,
        );
        return;
      }
    }

    await this.queueEmail({
      userId: dto.userId,
      to: dto.to,
      subject: 'Welcome to MarketX! 🎉',
      template: 'welcome',
      context: {
        name: dto.name,
        loginUrl: dto.loginUrl,
      },
    });
  }

  async sendAccountLocked(dto: AccountLockedEmailDto): Promise<void> {
    // Security emails always send regardless of preferences
    await this.queueEmail({
      userId: dto.userId,
      to: dto.to,
      subject: 'URGENT: Your MarketX Account Has Been Locked',
      template: 'account-locked',
      context: {
        name: dto.name,
      },
    });
  }

  // ── Queue ──────────────────────────────────────────────────────────────────

  /**
   * Push an email job onto the Bull queue for async processing.
   * Returns the email log record created for tracking.
   */
  async queueEmail(dto: SendEmailDto & { userId?: string }): Promise<EmailLog> {
    const log = await this.emailLogRepository.save(
      this.emailLogRepository.create({
        userId: dto.userId,
        to: dto.to,
        template: dto.template,
        subject: dto.subject,
        status: EmailStatus.QUEUED,
      }),
    );

    await this.emailQueue.add(
      EMAIL_JOB_SEND,
      { ...dto, logId: log.id },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );

    this.logger.debug(
      `Queued email "${dto.subject}" to ${dto.to} (logId: ${log.id})`,
    );
    return log;
  }

  // ── Direct send (used by processor) ───────────────────────────────────────

  /**
   * Send an email immediately via SendGrid.
   * Writes result to the email log identified by logId if provided.
   */
  async sendMail(dto: SendEmailDto & { logId?: string }): Promise<void> {
    const { to, subject, template, context, logId } = dto;
    const from =
      this.configService.get<string>('EMAIL_FROM') || 'noreply@marketx.com';

    let html: string;
    try {
      html = await this.renderTemplate(template, context || {});
    } catch (err) {
      this.logger.error(
        `Template render error for "${template}": ${err.message}`,
      );
      await this.updateLog(logId, EmailStatus.FAILED, null, err.message);
      throw err;
    }

    const msg = { to, from, subject, html };

    if (this.configService.get<string>('SENDGRID_API_KEY')) {
      try {
        const [response] = await sgMail.send(msg);
        const messageId =
          (response.headers?.['x-message-id'] as string) ?? null;
        this.logger.log(
          `Email sent to ${to} via template "${template}" (msgId: ${messageId})`,
        );
        await this.updateLog(logId, EmailStatus.SENT, messageId);
      } catch (error) {
        const errMsg =
          error?.response?.body?.errors?.[0]?.message ?? error.message;
        this.logger.error(`SendGrid error sending to ${to}: ${errMsg}`);
        await this.updateLog(logId, EmailStatus.FAILED, null, errMsg);
        throw error;
      }
    } else {
      // Dry-run mode — log but do not send
      this.logger.log(
        `[DRY-RUN] To: ${to} | Subject: ${subject} | Template: ${template}`,
      );
      await this.updateLog(logId, EmailStatus.SENT, 'dry-run');
    }
  }

  // ── Webhook / delivery tracking ────────────────────────────────────────────

  /**
   * Render a Handlebars template with layout support
   */
  private async renderTemplate(
    templateName: string,
    context: any,
  ): Promise<string> {
    const templateSource = await this.getTemplateSource(templateName);
    const template = handlebars.compile(templateSource);
    const content = template({
      ...context,
      year: new Date().getFullYear(),
    });

    // Check if we should use the base layout
    if (templateName !== 'base-layout') {
      try {
        const layoutSource = await this.getTemplateSource('base-layout');
        const layout = handlebars.compile(layoutSource);
        return layout({
          ...context,
          body: content,
          year: new Date().getFullYear(),
        });
      } catch (error) {
        this.logger.warn(
          `Base layout not found, sending template ${templateName} without layout.`,
        );
        return content;
      }
    }

    return content;
  }

  private async getTemplateSource(templateName: string): Promise<string> {
    const filePath = path.join(this.templatesPath, `${templateName}.hbs`);
    const sourcePath = path.join(
      process.cwd(),
      'src',
      'email',
      'templates',
      `${templateName}.hbs`,
    );

    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf8');
    } else if (fs.existsSync(sourcePath)) {
      return fs.readFileSync(sourcePath, 'utf8');
    } else {
      throw new Error(
        `Email template "${templateName}" not found at ${filePath} or ${sourcePath}`,
      );
    }
  }

  // ── Tracking & Logging ─────────────────────────────────────────────────────

  /**
   * Update the status and details of an email log entry.
   */
  async updateLog(
    logId: string | undefined,
    status: EmailStatus,
    messageId: string | null = null,
    error: string | null = null,
  ): Promise<void> {
    if (!logId) return;
    try {
      const updateData: Partial<EmailLog> = { status };
      if (messageId !== null) updateData.messageId = messageId;
      if (error !== null) updateData.errorMessage = error;
      if (status === EmailStatus.SENT) updateData.sentAt = new Date();
      if (status === EmailStatus.DELIVERED) updateData.deliveredAt = new Date();

      await this.emailLogRepository.update(logId, updateData);
    } catch (err) {
      this.logger.error(`Failed to update email log ${logId}: ${err.message}`);
    }
  }

  /**
   * Process a SendGrid webhook event to update email delivery status.
   */
  async trackDeliveryEvent(event: SendGridWebhookEventDto): Promise<void> {
    const messageId = event.sg_message_id?.split('.')[0];
    if (!messageId) return;

    const log = await this.emailLogRepository.findOne({ where: { messageId } });
    if (!log) {
      this.logger.warn(`No email log found for message ID: ${messageId}`);
      return;
    }

    let status = log.status;
    let error = log.errorMessage;

    switch (event.event) {
      case 'delivered':
        status = EmailStatus.DELIVERED;
        break;
      case 'bounce':
        status = EmailStatus.BOUNCED;
        error = event.reason || 'Bounced';
        break;
      case 'spamreport':
      case 'spam_report':
        status = EmailStatus.SPAM;
        break;
      case 'deferred':
      case 'dropped':
        status = EmailStatus.FAILED;
        error = event.reason || `Dropped (${event.event})`;
        break;
    }

    if (status !== log.status) {
      await this.updateLog(log.id, status, null, error);
    }
  }
}
