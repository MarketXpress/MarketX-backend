import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export enum InventoryChangeType {
  PURCHASE = 'PURCHASE',
  ADJUSTMENT = 'ADJUSTMENT',
  RESERVATION = 'RESERVATION',
  RELEASE = 'RELEASE',
  BULK_UPDATE = 'BULK_UPDATE',
}

@Entity('inventory_history')
export class InventoryHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  listingId: string;

  @Column()
  userId: string;

  @Column('int')
  change: number;

  @Column({ type: 'enum', enum: InventoryChangeType })
  type: InventoryChangeType;

  @Column({ nullable: true })
  note: string;

  @CreateDateColumn()
  createdAt: Date;
} 