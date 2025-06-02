// src/users/users.service.spec.ts (Profile Update Tests)
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { User } from './user.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';

describe('UsersService - Profile Update', () => {
  let service: UsersService;
  let repository: Repository<User>;

  const mockUser: User = {
    id: 1,
    email: 'test@example.com',
    password: 'hashedPassword',
    name: 'John Doe',
    bio: 'Original bio',
    avatarUrl: 'https://example.com/original.jpg',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    repository = module.get<Repository<User>>(getRepositoryToken(User));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('updateProfile', () => {
    it('should update user profile successfully', async () => {
      const updateDto: UpdateProfileDto = {
        name: 'Jane Doe',
        bio: 'Updated bio',
        avatarUrl: 'https://example.com/new-avatar.jpg',
      };

      const updatedUser = { ...mockUser, ...updateDto };

      mockRepository.findOne.mockResolvedValue(mockUser);
      mockRepository.save.mockResolvedValue(updatedUser);

      const result = await service.updateProfile(1, updateDto);

      expect(mockRepository.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(mockRepository.save).toHaveBeenCalledWith({
        ...mockUser,
        name: updateDto.name,
        bio: updateDto.bio,
        avatarUrl: updateDto.avatarUrl,
      });
      expect(result).toEqual(updatedUser);
    });

    it('should update only provided fields', async () => {
      const updateDto: UpdateProfileDto = {
        name: 'Jane Doe',
      };

      const updatedUser = { ...mockUser, name: updateDto.name };

      mockRepository.findOne.mockResolvedValue(mockUser);
      mockRepository.save.mockResolvedValue(updatedUser);

      const result = await service.updateProfile(1, updateDto);

      expect(mockRepository.save).toHaveBeenCalledWith({
        ...mockUser,
        name: updateDto.name,
      });
      expect(result.bio).toBe(mockUser.bio);
      expect(result.avatarUrl).toBe(mockUser.avatarUrl);
    });

    it('should throw NotFoundException when user does not exist', async () => {
      const updateDto: UpdateProfileDto = {
        name: 'Jane Doe',
      };

      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.updateProfile(999, updateDto)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockRepository.findOne).toHaveBeenCalledWith({ where: { id: 999 } });
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('should handle empty update dto', async () => {
      const updateDto: UpdateProfileDto = {};

      mockRepository.findOne.mockResolvedValue(mockUser);
      mockRepository.save.mockResolvedValue(mockUser);

      const result = await service.updateProfile(1, updateDto);

      expect(mockRepository.save).toHaveBeenCalledWith(mockUser);
      expect(result).toEqual(mockUser);
    });
  });
});