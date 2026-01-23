import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Listing } from '../listing/entities/listing.entity';
import { Users } from '../users/users.entity';

@Entity('chat')
export class Chat {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Listing)
  @JoinColumn({ name: 'listingId' })
  listing: Listing;

  @Column()
  listingId: string;

  @ManyToOne(() => Users)
  @JoinColumn({ name: 'senderId' })
  sender: Users;

  @Column()
  senderId: number;

  @ManyToOne(() => Users)
  @JoinColumn({ name: 'receiverId' })
  receiver: Users;

  @Column()
  receiverId: number;

  @Column('text')
  message: string;

  @CreateDateColumn()
  timestamp: Date;

  @Column({ default: false })
  isRead: boolean;

  @Column({ type: 'varchar', default: 'sent' })
  status: 'sent' | 'delivered' | 'read';
} 