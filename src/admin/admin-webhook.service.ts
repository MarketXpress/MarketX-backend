import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class AdminWebhookService {
  private readonly logger = new Logger(AdminWebhookService.name);
  private readonly webhookUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.webhookUrl = this.configService.get<string>('ADMIN_WEBHOOK_URL');
  }

  async notifyAdmin(event: string, details: any, riskScore?: number) {
    if (!this.webhookUrl) {
      this.logger.warn('ADMIN_WEBHOOK_URL not configured. Skipping notification.');
      return;
    }

    const payload = {
      content: `## 🚨 Admin Security Alert: ${event}`,
      embeds: [
        {
          title: event,
          color: riskScore && riskScore >= 90 ? 15158332 : 3447003, // Red for high risk, Blue otherwise
          fields: [
            ...Object.entries(details).map(([key, value]) => ({
              name: key.charAt(0).toUpperCase() + key.slice(1),
              value: String(value),
              inline: true,
            })),
            {
              name: 'Risk Score',
              value: riskScore?.toString() || 'N/A',
              inline: false,
            },
          ],
          timestamp: new Date().toISOString(),
        },
      ],
    };

    try {
      await firstValueFrom(this.httpService.post(this.webhookUrl, payload));
      this.logger.log(`Admin webhook dispatched for event: ${event}`);
    } catch (error) {
      this.logger.error(`Failed to dispatch admin webhook: ${error.message}`);
    }
  }
}
