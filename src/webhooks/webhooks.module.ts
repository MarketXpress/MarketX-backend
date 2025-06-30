import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { WebhooksService } from './webhooks.service';
import { WebhooksController } from './webhooks.controller';
import { Webhook } from './entities/webhook.entity';
import { EventDispatcherService } from './events/event-dispatcher.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Webhook]),
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 3,
    }),
    ConfigModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [WebhooksController],
  providers: [WebhooksService, EventDispatcherService],
  exports: [WebhooksService, EventDispatcherService],
})
export class WebhooksModule {}