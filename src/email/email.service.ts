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

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private readonly templatesPath = path.join(__dirname, 'templates');

  constructor(
    private readonly configService: ConfigService,
    private readonly emailPreferenceService: EmailPreferenceService,
    @InjectQueue('email') private readonly emailQueue: Queue,
    @InjectRepository(EmailLog)
    private readonly emailLogRepository: Repository<EmailLog>,
  ) { }

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
      const allowed = await this.emailPreferenceService.canReceive(dto.userId, 'order');
      if (!allowed) {
        this.logger.debug(`User ${dto.userId} opted out of order emails — skipping.`);
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
      const allowed = await this.emailPreferenceService.canReceive(dto.userId, 'shipping');
      if (!allowed) {
        this.logger.debug(`User ${dto.userId} opted out of shipping emails — skipping.`);
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
      const allowed = await this.emailPreferenceService.canReceive(dto.userId, 'account');
      if (!allowed) {
        this.logger.debug(`User ${dto.userId} opted out of account emails — skipping.`);
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

    await this.emailQueue.add('send-email', { ...dto, logId: log.id }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: true,
      removeOnFail: false,
    });

    this.logger.debug(`Queued email "${dto.subject}" to ${dto.to} (logId: ${log.id})`);
    return log;
  }

  // ── Direct send (used by processor) ───────────────────────────────────────

  /**
   * Send an email immediately via SendGrid.
   * Writes result to the email log identified by logId if provided.
   */
  async sendMail(dto: SendEmailDto & { logId?: string }): Promise<void> {
    const { to, subject, template, context, logId } = dto;
    const from = this.configService.get<string>('EMAIL_FROM') || 'noreply@marketx.com';

    let html: string;
    try {
      html = await this.renderTemplate(template, context || {});
    } catch (err) {
      this.logger.error(`Template render error for "${template}": ${err.message}`);
      await this.updateLog(logId, EmailStatus.FAILED, null, err.message);
      throw err;
    }

    const msg = { to, from, subject, html };

    if (this.configService.get<string>('SENDGRID_API_KEY')) {
      try {
        const [response] = await sgMail.send(msg);
        const messageId = (response.headers?.['x-message-id'] as string) ?? null;
        this.logger.log(`Email sent to ${to} via template "${template}" (msgId: ${messageId})`);
        await this.updateLog(logId, EmailStatus.SENT, messageId);
      } catch (error) {
        const errMsg = error?.response?.body?.errors?.[0]?.message ?? error.message;
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
   * Handle SendGrid delivery status webhook events and update the email log.
   */
  async trackDeliveryEvent(event: SendGridWebhookEventDto): Promise<void> {
    const messageId = event.sg_message_id?.split('.')?.[0]; // strip filter suffix
    if (!messageId) return;

    const log = await this.emailLogRepository.findOne({ where: { messageId } });
    if (!log) {
      this.logger.debug(`No email log for messageId "${messageId}" (event: ${event.event})`);
      return;
    }

    switch (event.event) {
      case 'delivered':
        log.status = EmailStatus.DELIVERED;
        log.deliveredAt = new Date(event.timestamp * 1000);
        break;
      case 'bounce':
        log.status = EmailStatus.BOUNCED;
        log.errorMessage = event.reason ?? 'Bounced';
        break;
      case 'spamreport':
        log.status = EmailStatus.SPAM;
        break;
      default:
        // open, click etc. — no status change needed
        return;
    }

    await this.emailLogRepository.save(log);
    this.logger.debug(`Email log ${log.id} updated to "${log.status}" via webhook`);
  }

  // ── Template rendering ─────────────────────────────────────────────────────

  private async renderTemplate(templateName: string, context: Record<string, any>): Promise<string> {
    const distPath = path.join(this.templatesPath, `${templateName}.hbs`);
    const srcPath = path.join(process.cwd(), 'src', 'email', 'templates', `${templateName}.hbs`);

    let source: string;
    if (fs.existsSync(distPath)) {
      source = fs.readFileSync(distPath, 'utf8');
    } else if (fs.existsSync(srcPath)) {
      source = fs.readFileSync(srcPath, 'utf8');
    } else {
      throw new Error(`Email template "${templateName}" not found at ${distPath} or ${srcPath}`);
    }

    const compiled = handlebars.compile(source);
    return compiled({ ...context, year: new Date().getFullYear() });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async updateLog(
    logId: string | undefined,
    status: EmailStatus,
    messageId?: string | null,
    errorMessage?: string,
  ): Promise<void> {
    if (!logId) return;
    try {
      const log = await this.emailLogRepository.findOne({ where: { id: logId } });
      if (!log) return;
      log.status = status;
      if (messageId !== undefined) log.messageId = messageId;
      if (errorMessage) log.errorMessage = errorMessage;
      if (status === EmailStatus.SENT) log.sentAt = new Date();
      log.attempts += 1;
      await this.emailLogRepository.save(log);
    } catch (err) {
      this.logger.warn(`Failed to update email log ${logId}: ${err.message}`);
    }
  }
}
