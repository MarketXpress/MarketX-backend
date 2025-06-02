import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity()
export class Listing {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column('text')
  description: string;

  @Column('decimal')
  price: number;

  @Column()
  category: string;

  @Column()
  location: string;

  @Column()
  ownerId: string;

  @CreateDateColumn()
  createdAt: Date;
}
