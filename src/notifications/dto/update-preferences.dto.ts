import { IsBoolean, IsObject, IsOptional } from 'class-validator';
import { NotificationType, NotificationChannel } from '../entities/notification.entity';

export class UpdatePreferencesDto {
  @IsObject()
  @IsOptional()
  preferences?: Record<NotificationType, NotificationChannel[]>;

  @IsBoolean()
  @IsOptional()
  emailEnabled?: boolean;

  @IsBoolean()
  @IsOptional()
  inAppEnabled?: boolean;

  @IsBoolean()
  @IsOptional()
  pushEnabled?: boolean;
}