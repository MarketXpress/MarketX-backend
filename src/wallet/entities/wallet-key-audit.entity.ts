import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity()
export class WalletKeyAudit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  oldPublicKey: string;

  @Column()
  oldSecretKey: string;

  @CreateDateColumn()
  createdAt: Date;
}
