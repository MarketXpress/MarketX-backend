import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Category Tree (Adjacency List)
 * - parentId points to another Category row (or null if root)
 * - children is the inverse side (not stored, derived via relation)
 */
@Entity()
@Index(['parentId']) // fast lookup of children for a parent
@Index(['name']) // useful for search/autocomplete
@Index(['parentId', 'name'], { unique: true }) // unique name per parent (no duplicates among siblings)
export class Category {
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ example: 'Electronics' })
  @Column('varchar', { length: 150 })
  name: string;

  @ApiProperty({ example: 'Phones, laptops, accessories', required: false })
  @Column('varchar', { length: 500, nullable: true })
  description?: string;

  @ApiProperty({ example: 'mdi:monitor', required: false })
  @Column('varchar', { length: 120, nullable: true })
  icon?: string;

  // Soft-disable categories without deleting:
  @ApiProperty({ example: true })
  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  /**
   * Parent relation (nullable for root categories)
   */
  @Column({ type: 'int', nullable: true })
  parentId?: number | null;

  @ManyToOne(() => Category, (category) => category.children, {
    nullable: true,
    onDelete: 'SET NULL', // deleting a parent shouldn't delete the entire subtree by accident
  })
  @JoinColumn({ name: 'parentId' })
  parent?: Category | null;

  /**
   * Children relation (inverse side)
   * Not stored in DB as a column; TypeORM loads it via joins.
   */
  @OneToMany(() => Category, (category) => category.parent)
  children: Category[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
