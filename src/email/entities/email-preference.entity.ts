import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('email_preferences')
export class EmailPreference {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column()
  userId: string;

  /** Order confirmation and status update emails */
  @Column({ default: true })
  orderEmails: boolean;

  /** Shipping notifications */
  @Column({ default: true })
  shippingEmails: boolean;

  /** Password reset and security emails (cannot be opted out of by design, but stored for consistency) */
  @Column({ default: true })
  securityEmails: boolean;

  /** Welcome and account-related emails */
  @Column({ default: true })
  accountEmails: boolean;

  /** Marketing, promotions and newsletters */
  @Column({ default: false })
  marketingEmails: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
