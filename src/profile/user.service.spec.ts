import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { UsersService } from '../users.service';
import { User, ProfileVisibility } from '../entities/user.entity';
import { UpdateProfileDto } from '../dto/update-profile.dto';

describe('UsersService', () => {
  let service: UsersService;
  let repository: Repository<User>;

  const mockUser: User = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    password: 'hashedPassword',
    firstName: 'John',
    lastName: 'Doe',
    phoneNumber: '+1234567890',
    profileImageUrl: 'https://example.com/profile.jpg',
    bio: 'Test bio',
    stellarWalletAddress: 'GABC123456789012345678901234567890123456789012345678',
    profileVisibility: ProfileVisibility.PUBLIC,
    sellerRating: 4.5,
    totalReviews: 10,
    totalSales: 25,
    isVerifiedSeller: true,
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    lastLoginAt: new Date('2024-01-15'),
  };

  const mockRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
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

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getProfile', () => {
    it('should return user profile successfully', async () => {
      mockRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.getProfile(mockUser.id);

      expect(result).toBeDefined();
      expect(result.id).toBe(mockUser.id);
      expect(result.email).toBe(mockUser.email);
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: mockUser.id },
      });
    });

    it('should throw NotFoundException when user does not exist', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.getProfile('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateProfile', () => {
    const updateDto: UpdateProfileDto = {
      firstName: 'Jane',
      lastName: 'Smith',
      bio: 'Updated bio',
      profileVisibility: ProfileVisibility.PRIVATE,
    };

    it('should update user profile successfully', async () => {
      const updatedUser = { ...mockUser, ...updateDto };
      mockRepository.findOne.mockResolvedValue(mockUser);
      mockRepository.save.mockResolvedValue(updatedUser);

      const result = await service.updateProfile(mockUser.id, updateDto);

      expect(result).toBeDefined();
      expect(result.firstName).toBe(updateDto.firstName);
      expect(result.lastName).toBe(updateDto.lastName);
      expect(repository.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException when user does not exist', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateProfile('non-existent-id', updateDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when stellar wallet is already in use', async () => {
      const walletUpdateDto: UpdateProfileDto = {
        stellarWalletAddress: 'GXYZ987654321098765432109876543210987654321098765432',
      };

      const otherUser = { ...mockUser, id: 'different-id' };

      mockRepository.findOne
        .mockResolvedValueOnce(mockUser) // First call for user lookup
        .mockResolvedValueOnce(otherUser); // Second call for wallet check

      await expect(
        service.updateProfile(mockUser.id, walletUpdateDto),
      ).rejects.toThrow(ConflictException);
    });

    it('should allow updating to same stellar wallet address', async () => {
      const walletUpdateDto: UpdateProfileDto = {
        stellarWalletAddress: mockUser.stellarWalletAddress,
      };

      mockRepository.findOne.mockResolvedValue(mockUser);
      mockRepository.save.mockResolvedValue(mockUser);

      const result = await service.updateProfile(mockUser.id, walletUpdateDto);

      expect(result).toBeDefined();
      expect(repository.save).toHaveBeenCalled();
    });
  });

  describe('getPublicProfile', () => {
    it('should return public profile when visibility is PUBLIC', async () => {
      mockRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.getPublicProfile(mockUser.id);

      expect(result).toBeDefined();
      expect(result.id).toBe(mockUser.id);
      expect(result.firstName).toBe(mockUser.firstName);
    });

    it('should throw ForbiddenException for PRIVATE profile when requester is different', async () => {
      const privateUser = { ...mockUser, profileVisibility: ProfileVisibility.PRIVATE };
      mockRepository.findOne.mockResolvedValue(privateUser);

      await expect(
        service.getPublicProfile(mockUser.id, 'different-user-id'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow owner to view their own PRIVATE profile', async () => {
      const privateUser = { ...mockUser, profileVisibility: ProfileVisibility.PRIVATE };
      mockRepository.findOne.mockResolvedValue(privateUser);

      const result = await service.getPublicProfile(mockUser.id, mockUser.id);

      expect(result).toBeDefined();
      expect(result.id).toBe(mockUser.id);
    });

    it('should throw ForbiddenException for CONTACTS_ONLY profile', async () => {
      const contactsOnlyUser = {
        ...mockUser,
        profileVisibility: ProfileVisibility.CONTACTS_ONLY,
      };
      mockRepository.findOne.mockResolvedValue(contactsOnlyUser);

      await expect(
        service.getPublicProfile(mockUser.id, 'different-user-id'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when user does not exist', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.getPublicProfile('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getUserTransactionHistory', () => {
    it('should return empty array (placeholder)', async () => {
      mockRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.getUserTransactionHistory(mockUser.id);

      expect(result).toEqual([]);
    });

    it('should throw NotFoundException when user does not exist', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(
        service.getUserTransactionHistory('non-existent-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getUserReviews', () => {
    it('should return empty array (placeholder)', async () => {
      mockRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.getUserReviews(mockUser.id);

      expect(result).toEqual([]);
    });

    it('should throw NotFoundException when user does not exist', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(
        service.getUserReviews('non-existent-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findById', () => {
    it('should return user when found', async () => {
      mockRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findById(mockUser.id);

      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException when user not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findById('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByEmail', () => {
    it('should return user when found', async () => {
      mockRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findByEmail(mockUser.email);

      expect(result).toEqual(mockUser);
    });

    it('should return null when user not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.findByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });
  });
});