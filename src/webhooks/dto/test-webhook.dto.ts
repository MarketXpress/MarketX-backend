import { IsEnum, IsObject, IsOptional } from 'class-validator';
import { WebhookEventType } from '../entities/webhook.entity';

export class TestWebhookDto {
  @IsEnum(WebhookEventType)
  eventType: WebhookEventType;

  @IsOptional()
  @IsObject()
  payload?: any;
}