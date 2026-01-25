import { SetMetadata } from '@nestjs/common';
import { NotificationType, NotificationPriority } from '../notification.entity';

export const NOTIFICATION_METADATA_KEY = 'notification_metadata';

export interface NotificationMetadata {
  type: NotificationType;
  priority?: NotificationPriority;
  template?: string;
  autoSend?: boolean;
}

export const Notification = (metadata: NotificationMetadata) =>
  SetMetadata(NOTIFICATION_METADATA_KEY, metadata);