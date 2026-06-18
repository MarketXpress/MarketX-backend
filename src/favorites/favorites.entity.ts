import { Entity, PrimaryColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../users/entities/user.entity';

@Entity('user_favorites')
export class UserFavorite {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  @PrimaryColumn({ name: 'product_id', type: 'uuid' })
  productId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // Optional relations depending on whether your schema loads product details inline
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}