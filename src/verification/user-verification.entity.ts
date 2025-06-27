import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { VerificationType, VerificationStatus, VerificationLevel } from './enums/verification.enums';

@Entity('user_verifications')
export class UserVerification {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column({ type: 'enum', enum: VerificationType })
  verificationType: VerificationType;

  @Column({ type: 'enum', enum: VerificationStatus, default: VerificationStatus.PENDING })
  status: VerificationStatus;

  @Column('simple-json', { nullable: true })
  documents: any;

  @Column({ type: 'enum', enum: VerificationLevel, default: VerificationLevel.BASIC })
  level: VerificationLevel;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
