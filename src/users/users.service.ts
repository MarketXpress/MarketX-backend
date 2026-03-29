import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { Users } from './users.entity';
import { CreateUserDto } from './dto/create-user-dto.dto';
import { CacheManagerService } from '../cache/cache-manager.service';


import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType, NotificationChannel } from '../notifications/notification.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(Users)
    private readonly userRepository: Repository<Users>,
    private readonly cacheManager: CacheManagerService,
    private readonly notificationsService: NotificationsService,
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

  async findOneWithCache(id: string) {
    return this.cacheManager.getOrSet(
      `user:${id}:profile`,
      async () => {
        return this.findOne(+id);
      },
      { 
        ttl: 7200, 
        tags: ['users', `user:${id}`] 
      }
    );
  }

  async findProfile(id: string) {
    return this.cacheManager.getOrSet(
      `user:${id}:public-profile`,
      async () => {
        return this.findOne(+id);
      },
      { 
        ttl: 3600, 
        tags: ['users', `user:${id}`, 'profiles'] 
      }
    );
  }

  async getUserStats(id: string) {
    return this.cacheManager.getOrSet(
      `user:${id}:stats`,
      async () => {
        return {
          totalListings: 0,
          totalSales: 0,
          rating: 0
        }; 
      },
      { 
        ttl: 1800, 
        tags: ['users', `user:${id}`, 'stats'] 
      }
    );
  }

  async validateRefreshToken(userId: string, token: string): Promise<boolean> {
    // Stub implementation - should compare hashed tokens
    return true;
  }

  async updateRefreshToken(userId: number, token: string | null): Promise<void> {
    await this.userRepository.update(userId, { refreshToken: token } as any);
  }
}