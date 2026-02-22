import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as sgMail from '@sendgrid/mail';
import * as handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';
import { SendEmailDto } from './dto/send-email.dto';

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private readonly templatesPath = path.join(__dirname, 'templates');

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const apiKey = this.configService.get<string>('SENDGRID_API_KEY');
    if (apiKey) {
      sgMail.setApiKey(apiKey);
      this.logger.log('SendGrid API initialized');
    } else {
      this.logger.warn('SENDGRID_API_KEY not found. Email service will only log emails.');
    }
  }

  /**
   * Send an email immediately
   */
  async sendMail(dto: SendEmailDto): Promise<void> {
    const { to, subject, template, context } = dto;
    const from = this.configService.get<string>('EMAIL_FROM') || 'noreply@marketx.com';

    try {
      const html = await this.renderTemplate(template, context || {});
      
      const msg = {
        to,
        from,
        subject,
        html,
      };

      if (this.configService.get<string>('SENDGRID_API_KEY')) {
        await sgMail.send(msg);
        this.logger.log(`Email sent successfully to ${to} with template ${template}`);
      } else {
        this.logger.log(`[DRY RUN] Email to: ${to}, Subject: ${subject}, Template: ${template}`);
        // this.logger.debug(`HTML Content: ${html}`);
      }
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Render a Handlebars template
   */
  private async renderTemplate(templateName: string, context: any): Promise<string> {
    const filePath = path.join(this.templatesPath, `${templateName}.hbs`);
    
    // Fallback for development if files aren't in dist yet
    const sourcePath = path.join(process.cwd(), 'src', 'email', 'templates', `${templateName}.hbs`);
    
    let templateSource: string;
    
    if (fs.existsSync(filePath)) {
      templateSource = fs.readFileSync(filePath, 'utf8');
    } else if (fs.existsSync(sourcePath)) {
      templateSource = fs.readFileSync(sourcePath, 'utf8');
    } else {
      throw new Error(`Template ${templateName} not found at ${filePath} or ${sourcePath}`);
    }

    const template = handlebars.compile(templateSource);
    return template({
      ...context,
      year: new Date().getFullYear(),
    });
  }
}
