import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsEnum, IsObject, IsDateString, IsUUID, IsInt, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { NotificationType, NotificationChannel, NotificationPriority } from '../notification.entity';

export class CreateNotificationDto {
  @ApiProperty({ description: 'User ID who will receive the notification' })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ description: 'Notification title' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ description: 'Notification message content' })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiPropertyOptional({ description: 'Type of notification', enum: NotificationType })
  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType;

  @ApiPropertyOptional({ description: 'Notification channel', enum: NotificationChannel })
  @IsOptional()
  @IsEnum(NotificationChannel)
  channel?: NotificationChannel;

  @ApiPropertyOptional({ description: 'Notification priority', enum: NotificationPriority })
  @IsOptional()
  @IsEnum(NotificationPriority)
  priority?: NotificationPriority;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Related entity ID' })
  @IsOptional()
  @IsString()
  relatedEntityId?: string;

  @ApiPropertyOptional({ description: 'Related entity type' })
  @IsOptional()
  @IsString()
  relatedEntityType?: string;

  @ApiPropertyOptional({ description: 'When to send the notification' })
  @IsOptional()
  @IsDateString()
  scheduledAt?: Date;

  @ApiPropertyOptional({ description: 'When the notification expires' })
  @IsOptional()
  @IsDateString()
  expiresAt?: Date;
}

export class UpdateNotificationDto {
  @ApiPropertyOptional({ description: 'Notification title' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Notification message content' })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiPropertyOptional({ description: 'Whether the notification has been read' })
  @IsOptional()
  @IsBoolean()
  read?: boolean;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class NotificationQueryDto {
  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Number of items per page', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Filter by read status' })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  read?: boolean;

  @ApiPropertyOptional({ description: 'Filter by notification type', enum: NotificationType })
  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType;

  @ApiPropertyOptional({ description: 'Filter by priority', enum: NotificationPriority })
  @IsOptional()
  @IsEnum(NotificationPriority)
  priority?: NotificationPriority;

  @ApiPropertyOptional({ description: 'Start date for filtering' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date for filtering' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Sort field', default: 'createdAt' })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ description: 'Sort order', enum: ['ASC', 'DESC'], default: 'DESC' })
  @IsOptional()
  @IsEnum(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}

export class BulkActionDto {
  @ApiProperty({ description: 'Array of notification IDs' })
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  notificationIds: string[];
}

export class TransactionNotificationDto {
  @ApiProperty({ description: 'User ID' })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ description: 'Transaction ID' })
  @IsString()
  @IsNotEmpty()
  transactionId: string;

  @ApiProperty({ description: 'Transaction amount' })
  @IsInt()
  @Min(0)
  amount: number;

  @ApiPropertyOptional({ description: 'Currency code', default: 'USD' })
  @IsOptional()
  @IsString()
  currency?: string = 'USD';
}