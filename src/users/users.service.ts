import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { Users } from './users.entity';
import { CreateUserDto } from './dto/create-user-dto.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(Users)
    private readonly userRepository: Repository<Users>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<Users> {
    const user = this.userRepository.create(createUserDto);
    const savedUser = await this.userRepository.save(user);

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
    const user = await this.findOne(userId);

    if (updateProfileDto.name !== undefined) user.name = updateProfileDto.name;
    if (updateProfileDto.bio !== undefined) user.bio = updateProfileDto.bio;
    if (updateProfileDto.avatarUrl !== undefined)
      user.avatarUrl = updateProfileDto.avatarUrl;
    if (updateProfileDto.language !== undefined)
      user.language = updateProfileDto.language.toLowerCase();

    return await this.userRepository.save(user);
  }

  async remove(id: number): Promise<void> {
    const result = await this.userRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
  }

  async softDeleteUser(id: number): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    await this.userRepository.update(id, {
      status: 'deleted',
      isActive: false,
    });
    await this.userRepository.softDelete(id);
  }

  getUserStats(_id: string) {
    return { totalListings: 0, totalSales: 0, rating: 0 };
  }

  async validateRefreshToken(userId: string, token: string): Promise<boolean> {
    const user = await this.findOne(parseInt(userId));
    return user && user.refreshToken === token;
  }

  async updateRefreshToken(
    userId: number,
    token: string | null,
  ): Promise<void> {
    await this.userRepository.update(userId, { refreshToken: token } as any);
  }

  async update2FA(
    userId: number,
    secret: string,
    enabled: boolean,
  ): Promise<void> {
    await this.userRepository.update(userId, {
      twoFASecret: secret,
      twoFAEnabled: enabled,
    });
  }

  async updatePassword(userId: number, passwordHash: string): Promise<void> {
    await this.userRepository.update(userId, { password: passwordHash });
  }
}
