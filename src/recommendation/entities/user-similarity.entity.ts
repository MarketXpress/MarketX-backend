import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * Stores user similarity scores for collaborative filtering
 */
@Entity('user_similarity')
@Index(['userIdA', 'userIdB'], { unique: true })
export class UserSimilarity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  userIdA: string;

  @Column('uuid')
  userIdB: string;

  @Column({ type: 'decimal', precision: 5, scale: 4, default: 0 })
  similarityScore: number; // Cosine similarity between users (0-1)

  @Column({ type: 'int', default: 0 })
  commonPurchases: number; // Number of items both users purchased

  @Column({ type: 'int', default: 0 })
  commonViews: number; // Number of items both users viewed

  @CreateDateColumn()
  calculatedAt: Date;
}
