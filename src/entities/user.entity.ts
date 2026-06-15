import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import * as bcrypt from 'bcrypt';

export enum UserRole {
  BUYER = 'buyer',
  SELLER = 'seller',
  ADMIN = 'admin',
  MODERATOR = 'moderator',
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  DELETED = 'deleted',
  LOCKED = 'locked',
}

@Entity('users')
@Index(['email'], { unique: true })
@Index(['createdAt'])
@Index(['status'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 255 })
  @Index()
  email: string;

  @Column({ length: 255 })
  @Exclude()
  password: string;

  @Column({ length: 100 })
  firstName: string;

  @Column({ length: 100 })
  lastName: string;

  @Column({ nullable: true, length: 20 })
  phoneNumber?: string;

  @Column({ nullable: true, length: 500 })
  bio?: string;

  @Column({ nullable: true, length: 500 })
  avatarUrl?: string;

  @Column({ nullable: true, unique: true, length: 56 })
  stellarWalletAddress?: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.BUYER })
  @Index()
  role: UserRole;

  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.ACTIVE })
  @Index()
  status: UserStatus;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true, type: 'text' })
  refreshToken?: string | null;

  @Column({ nullable: true, default: 'en' })
  language: string;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0 })
  sellerRating: number;

  @Column({ type: 'int', default: 0 })
  totalReviews: number;

  @Column({ type: 'int', default: 0 })
  totalSales: number;

  @Column({ default: false })
  isVerifiedSeller: boolean;

  @Column({ default: false })
  isEmailVerified: boolean;

  @Column({ default: false })
  isPhoneVerified: boolean;

  @Column({ nullable: true })
  lastLoginAt?: Date;

  @Column({ nullable: true, length: 45 })
  lastLoginIp?: string;

  @CreateDateColumn()
  @Index()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt?: Date;

  @BeforeInsert()
  @BeforeUpdate()
  async hashPassword() {
    if (this.password && !this.password.startsWith('$2b$')) {
      const salt = await bcrypt.genSalt(12);
      this.password = await bcrypt.hash(this.password, salt);
    }
  }

  async validatePassword(password: string): Promise<boolean> {
    return bcrypt.compare(password, this.password);
  }

  get fullName(): string {
    return `${this.firstName} ${this.lastName}`.trim();
  }

  toJSON() {
    const { password: _pw, refreshToken: _rt, ...result } = this;
    return result;
  }
}
