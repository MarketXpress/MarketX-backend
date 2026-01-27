import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { NotificationType, NotificationChannel } from './notification.entity';

@Entity('notification_preferences')
export class NotificationPreferencesEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  userId: string;

  @Column('jsonb', {
    default: {
      order_created: ['email', 'in_app'],
      order_updated: ['in_app'],
      order_cancelled: ['email', 'in_app'],
      order_completed: ['email', 'in_app'],
      payment_received: ['email', 'in_app'],
      payment_failed: ['email', 'in_app'],
      message_received: ['in_app'],
      system_alert: ['email', 'in_app'],
    },
  })
  preferences: Record<NotificationType, NotificationChannel[]>;

  @Column({ default: true })
  emailEnabled: boolean;

  @Column({ default: true })
  inAppEnabled: boolean;

  @Column({ default: false })
  pushEnabled: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}