import { Users } from '../../users/users.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';

@Entity()
export class Wallet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  publicKey: string;

  @Column()
  secretKey: string;

  @CreateDateColumn()
  createdAt: Date;

  @OneToOne(() => Users)
  @JoinColumn()
  user: Users;

  @Column() // This is KEY: required for querying by userId
  userId: string;
}
