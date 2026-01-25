import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, Unique } from 'typeorm';
import { Users } from '../../users/users.entity';
import { Order } from '../../orders/entities/order.entity';

@Entity()
@Unique(['order', 'buyer']) // Prevent duplicate reviews per order
export class Review {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  rating: number; // 1-5 stars

  @Column({ type: 'text', nullable: true })
  comment?: string;

  @ManyToOne(() => Users, { eager: true })
  buyer: Users;

  @ManyToOne(() => Users, { eager: true })
  seller: Users;

  @ManyToOne(() => Order, { eager: true })
  order: Order;

  @Column({ default: false })
  reported: boolean; // For moderation

  @CreateDateColumn()
  createdAt: Date;
}
