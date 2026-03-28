import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { Users } from './users.entity';
import { CreateUserDto } from './dto/create-user-dto.dto';
import { CacheManagerService } from '../cache/cache-manager.service';
import { Listing } from '../listing/entities/listing.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(Users)
    private readonly userRepository: Repository<Users>,
    @InjectRepository(Listing)
    private readonly listingRepository: Repository<Listing>,
    private readonly cacheManager: CacheManagerService,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<Users> {
    const user = this.userRepository.create(createUserDto);
    return await this.userRepository.save(user);
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
    await this.userRepository.update(id, { status: 'deleted', isActive: false });
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
    _userId: string,
    _token: string,
  ): Promise<boolean> {
    // Stub implementation - should compare hashed tokens
    return true;
  }

  async updateRefreshToken(userId: number, token: string | null): Promise<void> {
    await this.userRepository.update(userId, { refreshToken: token } as any);
  }
}