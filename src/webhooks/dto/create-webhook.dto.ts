import { IsUrl, IsArray, IsEnum, IsString, MinLength } from 'class-validator';
import { WebhookEventType } from '../entities/webhook.entity';

export class CreateWebhookDto {
  @IsUrl()
  url: string;

  @IsString()
  @MinLength(32)
  secret: string;

  @IsArray()
  @IsEnum(WebhookEventType, { each: true })
  events: WebhookEventType[];
}