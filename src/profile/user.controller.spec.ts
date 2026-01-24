import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from '../users.controller';
import { UsersService } from '../users.service';
import { ProfileVisibility } from '../entities/user.entity';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { ProfileResponseDto } from '../dto/profile-response.dto';
import { PublicProfileDto } from '../dto/public-profile.dto';

describe('UsersController', () => {
  let controller: UsersController;
  let service: UsersService;

  const mockProfileResponse: ProfileResponseDto = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
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
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const mockPublicProfile: PublicProfileDto = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    firstName: 'John',
    lastName: 'Doe',
    profileImageUrl: 'https://example.com/profile.jpg',
    bio: 'Test bio',
    sellerRating: 4.5,
    totalReviews: 10,
    totalSales: 25,
    isVerifiedSeller: true,
    createdAt: new Date('2024-01-01'),
  };

  const mockUsersService = {
    getProfile: jest.fn(),
    updateProfile: jest.fn(),
    getPublicProfile: jest.fn(),
    getUserTransactionHistory: jest.fn(),
    getUserReviews: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get<UsersService>(UsersService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getProfile', () => {
    it('should return current user profile', async () => {
      const mockRequest = {
        user: { id: mockProfileResponse.id },
      };

      mockUsersService.getProfile.mockResolvedValue(mockProfileResponse);

      const result = await controller.getProfile(mockRequest);

      expect(result).toEqual(mockProfileResponse);
      expect(service.getProfile).toHaveBeenCalledWith(mockRequest.user.id);
    });

    it('should handle userId field variation', async () => {
      const mockRequest = {
        user: { userId: mockProfileResponse.id },
      };

      mockUsersService.getProfile.mockResolvedValue(mockProfileResponse);

      const result = await controller.getProfile(mockRequest);

      expect(result).toEqual(mockProfileResponse);
      expect(service.getProfile).toHaveBeenCalledWith(mockProfileResponse.id);
    });
  });

  describe('updateProfile', () => {
    it('should update user profile successfully', async () => {
      const updateDto: UpdateProfileDto = {
        firstName: 'Jane',
        lastName: 'Smith',
        bio: 'Updated bio',
      };

      const mockRequest = {
        user: { id: mockProfileResponse.id },
      };

      const updatedProfile = { ...mockProfileResponse, ...updateDto };
      mockUsersService.updateProfile.mockResolvedValue(updatedProfile);

      const result = await controller.updateProfile(mockRequest, updateDto);

      expect(result).toEqual(updatedProfile);
      expect(service.updateProfile).toHaveBeenCalledWith(
        mockRequest.user.id,
        updateDto,
      );
    });

    it('should update stellar wallet address', async () => {
      const updateDto: UpdateProfileDto = {
        stellarWalletAddress: 'GXYZ987654321098765432109876543210987654321098765432',
      };

      const mockRequest = {
        user: { id: mockProfileResponse.id },
      };

      const updatedProfile = { ...mockProfileResponse, ...updateDto };
      mockUsersService.updateProfile.mockResolvedValue(updatedProfile);

      const result = await controller.updateProfile(mockRequest, updateDto);

      expect(result.stellarWalletAddress).toBe(updateDto.stellarWalletAddress);
      expect(service.updateProfile).toHaveBeenCalledWith(
        mockRequest.user.id,
        updateDto,
      );
    });

    it('should update profile visibility', async () => {
      const updateDto: UpdateProfileDto = {
        profileVisibility: ProfileVisibility.PRIVATE,
      };

      const mockRequest = {
        user: { id: mockProfileResponse.id },
      };

      const updatedProfile = { ...mockProfileResponse, ...updateDto };
      mockUsersService.updateProfile.mockResolvedValue(updatedProfile);

      const result = await controller.updateProfile(mockRequest, updateDto);

      expect(result.profileVisibility).toBe(ProfileVisibility.PRIVATE);
    });
  });

  describe('getPublicProfile', () => {
    it('should return public profile without authentication', async () => {
      const mockRequest = {};
      mockUsersService.getPublicProfile.mockResolvedValue(mockPublicProfile);

      const result = await controller.getPublicProfile(
        mockProfileResponse.id,
        mockRequest,
      );

      expect(result).toEqual(mockPublicProfile);
      expect(service.getPublicProfile).toHaveBeenCalledWith(
        mockProfileResponse.id,
        undefined,
      );
    });

    it('should return public profile with authentication', async () => {
      const mockRequest = {
        user: { id: 'another-user-id' },
      };
      mockUsersService.getPublicProfile.mockResolvedValue(mockPublicProfile);

      const result = await controller.getPublicProfile(
        mockProfileResponse.id,
        mockRequest,
      );

      expect(result).toEqual(mockPublicProfile);
      expect(service.getPublicProfile).toHaveBeenCalledWith(
        mockProfileResponse.id,
        'another-user-id',
      );
    });
  });

  describe('getTransactionHistory', () => {
    it('should return transaction history', async () => {
      const mockTransactions = [];
      const mockRequest = {
        user: { id: mockProfileResponse.id },
      };

      mockUsersService.getUserTransactionHistory.mockResolvedValue(
        mockTransactions,
      );

      const result = await controller.getTransactionHistory(mockRequest);

      expect(result).toEqual(mockTransactions);
      expect(service.getUserTransactionHistory).toHaveBeenCalledWith(
        mockRequest.user.id,
      );
    });
  });

  describe('getReviews', () => {
    it('should return reviews for current user', async () => {
      const mockReviews = [];
      const mockRequest = {
        user: { id: mockProfileResponse.id },
      };

      mockUsersService.getUserReviews.mockResolvedValue(mockReviews);

      const result = await controller.getReviews(mockRequest);

      expect(result).toEqual(mockReviews);
      expect(service.getUserReviews).toHaveBeenCalledWith(mockRequest.user.id);
    });
  });

  describe('getPublicReviews', () => {
    it('should return public reviews for any user', async () => {
      const mockReviews = [];

      mockUsersService.getUserReviews.mockResolvedValue(mockReviews);

      const result = await controller.getPublicReviews(mockProfileResponse.id);

      expect(result).toEqual(mockReviews);
      expect(service.getUserReviews).toHaveBeenCalledWith(
        mockProfileResponse.id,
      );
    });
  });
});