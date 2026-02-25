import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    Index,
} from 'typeorm';

export enum EmailStatus {
    QUEUED = 'queued',
    SENT = 'sent',
    FAILED = 'failed',
    DELIVERED = 'delivered',
    BOUNCED = 'bounced',
    SPAM = 'spam',
}

@Entity('email_logs')
export class EmailLog {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    /** Associated user (optional — some emails may not have a userId) */
    @Index()
    @Column({ nullable: true })
    userId: string;

    @Column()
    to: string;

    @Column()
    template: string;

    @Column()
    subject: string;

    @Column({
        type: 'enum',
        enum: EmailStatus,
        default: EmailStatus.QUEUED,
    })
    status: EmailStatus;

    /** SendGrid message ID returned from the API response headers */
    @Index()
    @Column({ nullable: true, type: 'varchar' })
    messageId: string | null;

    @Column({ nullable: true, type: 'text' })
    errorMessage: string;

    /** Number of retry attempts made */
    @Column({ default: 0 })
    attempts: number;

    @Column({ nullable: true })
    sentAt: Date;

    /** Timestamp the email was delivered (from SendGrid webhook) */
    @Column({ nullable: true })
    deliveredAt: Date;

    @CreateDateColumn()
    createdAt: Date;
}
