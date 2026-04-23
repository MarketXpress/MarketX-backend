import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { Users } from './users.entity';
import { CreateUserDto } from './dto/create-user-dto.dto';
import { CacheManagerService } from '../cache/cache-manager.service';
import { Listing } from '../listing/entities/listing.entity';

import { NotificationsService } from '../notifications/notifications.service';
import {
  NotificationType,
  NotificationChannel,
} from '../notifications/notification.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(Users)
    private readonly userRepository: Repository<Users>,
    @InjectRepository(Listing)
    private readonly listingRepository: Repository<Listing>,
    private readonly cacheManager: CacheManagerService,
    private readonly notificationsService: NotificationsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<Users> {
    const user = this.userRepository.create(createUserDto);
    const savedUser = await this.userRepository.save(user);

    // Trigger welcome email
    await this.notificationsService.createNotification({
      userId: savedUser.id.toString(),
      type: NotificationType.WELCOME,
      title: 'Welcome to MarketX!',
      message: `Hi ${savedUser.name || 'there'}, welcome to MarketX! We're glad to have you here.`,
      channel: NotificationChannel.EMAIL,
      metadata: {
        name: savedUser.name || 'User',
        email: savedUser.email,
      },
    } as any);

    this.eventEmitter.emit('user.created', {
      id: savedUser.id.toString(),
      email: savedUser.email,
      name: savedUser.name,
      createdAt: new Date().toISOString(),
    });

    return savedUser;
  }

  async findAll(): Promise<Users[]> {
    return await this.userRepository.find();
  }

  async findOne(id: number): Promise<Users> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  async findByEmail(email: string): Promise<Users | null> {
    return await this.userRepository.findOne({ where: { email } });
  }

  async updateProfile(
    userId: number,
    updateProfileDto: UpdateProfileDto,
  ): Promise<Users> {
    // Check if user exists

    const user = await this.findOne(userId);

    // Update provided fields

    if (updateProfileDto.name !== undefined) {
      user.name = updateProfileDto.name;
    }
    if (updateProfileDto.bio !== undefined) {
      user.bio = updateProfileDto.bio;
    }
    if (updateProfileDto.avatarUrl !== undefined) {
      user.avatarUrl = updateProfileDto.avatarUrl;
    }
    if (updateProfileDto.language !== undefined) {
      user.language = updateProfileDto.language.toLowerCase();
    }

    // Save and return updated user

    const updatedUser = await this.userRepository.save(user);
    return updatedUser;
  }

  async remove(id: number): Promise<void> {
    const result = await this.userRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
  }

  /**
   * Soft-deletes a user and cascades the soft-delete to all their listings.
   * Sets status = 'deleted' and isActive = false.
   * The user row is retained for financial integrity; PII is purged later by PiiPurgeTask.
   */
  async softDeleteUser(id: number): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Mark user as deleted
    await this.userRepository.update(id, {
      status: 'deleted',
      isActive: false,
    });
    await this.userRepository.softDelete(id);

    // Cascade soft-delete to all listings owned by this user
    await this.listingRepository.softDelete({ userId: String(id) });
  }

  async findOneWithCache(id: string) {
    return this.cacheManager.getOrSet(
      `user:${id}:profile`,
      async () => {
        return this.findOne(+id);
      },
      { ttl: 7200, tags: ['users', `user:${id}`] },
    );
  }

  async findProfile(id: string) {
    return this.cacheManager.getOrSet(
      `user:${id}:public-profile`,
      async () => {
        return this.findOne(+id);
      },
      { ttl: 3600, tags: ['users', `user:${id}`, 'profiles'] },
    );
  }

  async getUserStats(id: string) {
    return this.cacheManager.getOrSet(
      `user:${id}:stats`,
      async () => {
        return {
          totalListings: 0,
          totalSales: 0,
          rating: 0,
        };
      },
      { ttl: 1800, tags: ['users', `user:${id}`, 'stats'] },
    );
  }

  async validateRefreshToken(
    userId: string,
    token: string,
  ): Promise<boolean> {
    const user = await this.findOne(parseInt(userId));
    return user && user.refreshToken === token;
  }

  async updateRefreshToken(
    userId: number,
    token: string | null,
  ): Promise<void> {
    await this.userRepository.update(userId, { refreshToken: token } as any);
  }
}
