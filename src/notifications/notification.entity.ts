import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { User } from '../users/user.entity';



export enum NotificationType {
  TRANSACTION_RECEIVED = 'transaction_received',
  TRANSACTION_SENT = 'transaction_sent',
  PAYMENT_SUCCESS = 'payment_success',
  PAYMENT_FAILED = 'payment_failed',
  SYSTEM_ALERT = 'system_alert',
  ACCOUNT_UPDATE = 'account_update',
  SECURITY_ALERT = 'security_alert',
  PROMOTION = 'promotion',
  REMINDER = 'reminder',
}

export enum NotificationChannel {
  IN_APP = 'in_app',
  EMAIL = 'email',
  SMS = 'sms',
  PUSH = 'push',
}

export enum NotificationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

@Entity('notifications')
@Index(['userId', 'createdAt'])
@Index(['read', 'createdAt'])
export class NotificationEntity {
  @ApiProperty({ description: 'Unique notification identifier' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'User ID who receives the notification' })
  @Column({ name: 'user_id' })
  @Index()
  userId: string;

  @ApiProperty({ description: 'Notification title' })
  @Column()
  title: string;

  @ApiProperty({ description: 'Notification message content' })
  @Column('text')
  message: string;

  @ApiProperty({ description: 'Whether the notification has been read', default: false })
  @Column({ default: false })
  read: boolean;

  @ApiProperty({ description: 'Type of notification', enum: NotificationType })
  @Column({
    type: 'enum',
    enum: NotificationType,
    default: NotificationType.SYSTEM_ALERT,
  })
  type: NotificationType;

  @ApiProperty({ description: 'Notification channel', enum: NotificationChannel })
  @Column({
    type: 'enum',
    enum: NotificationChannel,
    default: NotificationChannel.IN_APP,
  })
  channel: NotificationChannel;

  @ApiProperty({ description: 'Notification priority', enum: NotificationPriority })
  @Column({
    type: 'enum',
    enum: NotificationPriority,
    default: NotificationPriority.MEDIUM,
  })
  priority: NotificationPriority;

  @ApiProperty({ description: 'Additional metadata for the notification' })
  @Column('json', { nullable: true })
  metadata: Record<string, any>;

  @ApiProperty({ description: 'Related entity ID (transaction, payment, etc.)' })
  @Column({ name: 'related_entity_id', nullable: true })
  relatedEntityId: string;

  @ApiProperty({ description: 'Related entity type' })
  @Column({ name: 'related_entity_type', nullable: true })
  relatedEntityType: string;

  @ApiProperty({ description: 'When the notification should be sent' })
  @Column({ name: 'scheduled_at', nullable: true })
  scheduledAt: Date;

  @ApiProperty({ description: 'When the notification was actually sent' })
  @Column({ name: 'sent_at', nullable: true })
  sentAt: Date;

  @ApiProperty({ description: 'When the notification was read' })
  @Column({ name: 'read_at', nullable: true })
  readAt: Date;

  @ApiProperty({ description: 'When the notification expires' })
  @Column({ name: 'expires_at', nullable: true })
  expiresAt: Date;

  @ApiProperty({ description: 'Notification creation timestamp' })
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty({ description: 'Notification last update timestamp' })
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

    @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'recipient_id' })
  recipient: User;

  @Column({ name: 'recipient_id' })
  recipientId: number;

}
function ManyToOne(arg0: () => typeof User, arg1: { eager: boolean; }): (target: NotificationEntity, propertyKey: "recipient") => void {
  throw new Error('Function not implemented.');
}

function JoinColumn(arg0: { name: string; }): (target: NotificationEntity, propertyKey: "recipient") => void {
  throw new Error('Function not implemented.');
}

