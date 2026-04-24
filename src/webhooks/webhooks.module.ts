import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';

import { WebhooksService } from './webhooks.service';
import { EventDispatcherService } from './event-dispatcher.service';
import { Webhook } from './entities/webhook.entity';
import { WebhooksController } from './webhooks.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Webhook]),
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 3,
    }),
  ],
  controllers: [WebhooksController],
  providers: [WebhooksService, EventDispatcherService],
  exports: [WebhooksService, EventDispatcherService],
})
export class WebhooksModule {}
