import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Users } from '../../users/users.entity';

/**
 * Tracks user browsing history for recommendation purposes
 */
@Entity('browsing_history')
@Index(['userId', 'viewedAt'])
@Index(['listingId', 'viewedAt'])
export class BrowsingHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  userId: string;

  @ManyToOne(() => Users, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: Users;

  @Column('uuid')
  listingId: string;

  @CreateDateColumn()
  viewedAt: Date;

  @Column({ type: 'int', default: 0 })
  viewDuration: number; // seconds spent viewing

  @Column({ default: false })
  addedToCart: boolean;

  @Column({ default: false })
  purchased: boolean;
}
