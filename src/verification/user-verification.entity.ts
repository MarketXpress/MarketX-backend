import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import {
  VerificationType,
  VerificationStatus,
  VerificationLevel,
  VerificationStep,
} from './enums/verification.enums';
import { Users } from '../users/users.entity';

@Entity('user_verifications')
export class UserVerification {
  @ApiProperty({ description: 'Verification ID' })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ description: 'User ID' })
  @Column()
  userId: number;

  @ApiProperty({ description: 'Verification type', enum: VerificationType })
  @Column({ type: 'enum', enum: VerificationType })
  verificationType: VerificationType;

  @ApiProperty({ description: 'Verification status', enum: VerificationStatus })
  @Column({
    type: 'enum',
    enum: VerificationStatus,
    default: VerificationStatus.PENDING,
  })
  status: VerificationStatus;

  @ApiProperty({ description: 'Verification level', enum: VerificationLevel })
  @Column({
    type: 'enum',
    enum: VerificationLevel,
    default: VerificationLevel.BASIC,
  })
  level: VerificationLevel;

  @ApiProperty({
    description: 'Current verification step',
    enum: VerificationStep,
  })
  @Column({
    type: 'enum',
    enum: VerificationStep,
    default: VerificationStep.PERSONAL_INFO,
  })
  currentStep: VerificationStep;

  @ApiProperty({ description: 'Personal information data' })
  @Column('json', { nullable: true })
  personalInfo: {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    address: string;
    city: string;
    country: string;
    postalCode: string;
  };

  @ApiProperty({ description: 'Business information for seller verification' })
  @Column('json', { nullable: true })
  businessInfo: {
    businessName: string;
    businessType: string;
    registrationNumber: string;
    taxId: string;
    businessAddress: string;
    website?: string;
    description?: string;
  };

  @ApiProperty({ description: 'Uploaded documents metadata' })
  @Column('json', { nullable: true })
  documents: {
    [key: string]: {
      url: string;
      type: string;
      uploadedAt: Date;
      verified: boolean;
    };
  };

  @ApiProperty({ description: 'Admin review notes' })
  @Column('text', { nullable: true })
  adminNotes: string;

  @ApiProperty({ description: 'Rejection reason' })
  @Column('text', { nullable: true })
  rejectionReason: string;

  @ApiProperty({ description: 'Verification expiry date' })
  @Column({ nullable: true })
  expiresAt: Date;

  @ApiProperty({ description: 'Last reviewed by admin' })
  @Column({ nullable: true })
  reviewedBy: number;

  @ApiProperty({ description: 'Verification completion date' })
  @Column({ nullable: true })
  verifiedAt: Date;

  @ApiProperty({ description: 'Number of retry attempts' })
  @Column({ default: 0 })
  retryCount: number;

  @ApiProperty({ description: 'Verification metadata' })
  @Column('json', { nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Users, { eager: false })
  @JoinColumn({ name: 'userId' })
  user: Users;

  @ManyToOne(() => Users, { eager: false })
  @JoinColumn({ name: 'reviewedBy' })
  reviewer: Users;
}
