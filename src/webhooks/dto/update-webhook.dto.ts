import { PartialType } from '@nestjs/mapped-types';
import { CreateWebhookDto } from './create-webhook.dto';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateWebhookDto extends PartialType(CreateWebhookDto) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}