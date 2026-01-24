import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, ProfileVisibility } from './user.entity';
import { UpdateProfileDto } from './update-profile.dto';
import { ProfileResponseDto } from './profile-response.dto';
import { PublicProfileDto } from './public-profile.dto';
import { plainToClass } from 'class-transformer';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async getProfile(userId: string): Promise<ProfileResponseDto> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return plainToClass(ProfileResponseDto, user, {
      excludeExtraneousValues: true,
    });
  }

  async updateProfile(
    userId: string,
    updateProfileDto: UpdateProfileDto,
  ): Promise<ProfileResponseDto> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if stellar wallet address is being updated and is already in use
    if (
      updateProfileDto.stellarWalletAddress &&
      updateProfileDto.stellarWalletAddress !== user.stellarWalletAddress
    ) {
      const existingWallet = await this.userRepository.findOne({
        where: { stellarWalletAddress: updateProfileDto.stellarWalletAddress },
      });

      if (existingWallet) {
        throw new ConflictException('Stellar wallet address already in use');
      }
    }

    // Update user fields
    Object.assign(user, updateProfileDto);

    const updatedUser = await this.userRepository.save(user);

    return plainToClass(ProfileResponseDto, updatedUser, {
      excludeExtraneousValues: true,
    });
  }

  async getPublicProfile(
    userId: string,
    requesterId?: string,
  ): Promise<PublicProfileDto> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check privacy settings
    if (user.profileVisibility === ProfileVisibility.PRIVATE) {
      // Only the user themselves can view their private profile
      if (!requesterId || requesterId !== userId) {
        throw new ForbiddenException('This profile is private');
      }
    }

    // For CONTACTS_ONLY, you would need to implement a contacts/friends system
    // For now, we'll treat it similar to PRIVATE for non-owners
    if (user.profileVisibility === ProfileVisibility.CONTACTS_ONLY) {
      if (!requesterId || requesterId !== userId) {
        // TODO: Check if requester is in user's contacts
        throw new ForbiddenException(
          'This profile is only visible to contacts',
        );
      }
    }

    return plainToClass(PublicProfileDto, user, {
      excludeExtraneousValues: true,
    });
  }

  async getUserTransactionHistory(userId: string): Promise<any[]> {
    // This will be implemented when you create the transactions module
    // For now, return empty array
    const user = await this.userRepository.findOne({
      where: { id: userId },
      // relations: ['transactions'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // TODO: Return user.transactions when relation is set up
    return [];
  }

  async getUserReviews(userId: string): Promise<any[]> {
    // This will be implemented when you create the reviews module
    const user = await this.userRepository.findOne({
      where: { id: userId },
      // relations: ['receivedReviews'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // TODO: Return user.receivedReviews when relation is set up
    return [];
  }

  // Helper method to find user by ID
  async findById(userId: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  // Helper method to find user by email
  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { email },
    });
  }
}