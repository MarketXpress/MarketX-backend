import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';

import { WebhooksService } from './webhooks.service';
import { EventDispatcherService } from './event-dispatcher.service';
import { Webhook } from './entities/webhook.entity';
import { WebhooksController } from './webhooks.controller';
import { WebhookVerificationGuard } from './guards/webhook-verification.guard';
import { WebhooksMetricsService } from './services/webhooks-metrics.service';
import { RedisCacheModule } from '../redis-caching/redis-cache.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Webhook]),
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 3,
    }),
    RedisCacheModule,
  ],
  controllers: [WebhooksController],
  providers: [
    WebhooksService,
    EventDispatcherService,
    WebhookVerificationGuard,
    WebhooksMetricsService,
  ],
  exports: [
    WebhooksService,
    EventDispatcherService,
    WebhookVerificationGuard,
    WebhooksMetricsService,
  ],
})
export class WebhooksModule {}
