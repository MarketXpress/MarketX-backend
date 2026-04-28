import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LoyaltyService } from './loyalty.service';
import { LoyaltyTier, LoyaltyTierName } from './entities/loyalty-tier.entity';
import { UserLoyaltyTier } from './entities/user-loyalty-tier.entity';
import { RewardPoints } from './entities/reward-points.entity';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('LoyaltyService', () => {
  let service: LoyaltyService;
  let loyaltyTierRepository: jest.Mocked<Repository<LoyaltyTier>>;
  let userLoyaltyTierRepository: jest.Mocked<Repository<UserLoyaltyTier>>;
  let rewardPointsRepository: jest.Mocked<Repository<RewardPoints>>;

  const mockUserId = 'user-123';

  const mockBronzeTier: LoyaltyTier = {
    id: 'bronze-id',
    tierName: LoyaltyTierName.BRONZE,
    displayName: 'Bronze Member',
    description: 'Welcome tier',
    minPoints: 0,
    maxPoints: 999,
    benefits: {
      pointsMultiplier: 1,
      discountPercentage: 0,
      freeShippingThreshold: 50,
      exclusiveAccess: [],
      birthdayBonus: 50,
      anniversaryBonus: 25,
    },
    color: '#CD7F32',
    isActive: true,
    sortOrder: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSilverTier: LoyaltyTier = {
    id: 'silver-id',
    tierName: LoyaltyTierName.SILVER,
    displayName: 'Silver Member',
    description: 'Enhanced rewards',
    minPoints: 1000,
    maxPoints: 4999,
    benefits: {
      pointsMultiplier: 1.2,
      discountPercentage: 5,
      freeShippingThreshold: 35,
      exclusiveAccess: ['early_sales'],
      birthdayBonus: 100,
      anniversaryBonus: 50,
    },
    color: '#C0C0C0',
    isActive: true,
    sortOrder: 2,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUserLoyaltyTier: UserLoyaltyTier = {
    id: 'user-tier-id',
    userId: mockUserId,
    currentTierId: mockBronzeTier.id,
    lifetimePoints: 500,
    currentYearPoints: 300,
    tierUpgradeDate: undefined,
    monthsAtCurrentTier: 3,
    tierProgress: {
      pointsToNextTier: 500,
      nextTierName: 'Silver Member',
      progressPercentage: 50,
    },
    lastActivityDate: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockLoyaltyTierRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      count: jest.fn(),
    };

    const mockUserLoyaltyTierRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    const mockRewardPointsRepository = {
      // Mock if needed
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoyaltyService,
        {
          provide: getRepositoryToken(LoyaltyTier),
          useValue: mockLoyaltyTierRepository,
        },
        {
          provide: getRepositoryToken(UserLoyaltyTier),
          useValue: mockUserLoyaltyTierRepository,
        },
        {
          provide: getRepositoryToken(RewardPoints),
          useValue: mockRewardPointsRepository,
        },
      ],
    }).compile();

    service = module.get<LoyaltyService>(LoyaltyService);
    loyaltyTierRepository = module.get(getRepositoryToken(LoyaltyTier));
    userLoyaltyTierRepository = module.get(getRepositoryToken(UserLoyaltyTier));
    rewardPointsRepository = module.get(getRepositoryToken(RewardPoints));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createLoyaltyTier', () => {
    it('should create a new loyalty tier', async () => {
      const createDto = {
        tierName: LoyaltyTierName.GOLD,
        displayName: 'Gold Member',
        minPoints: 5000,
        benefits: {
          pointsMultiplier: 1.5,
          discountPercentage: 10,
          freeShippingThreshold: 25,
          exclusiveAccess: ['early_sales', 'gold_events'],
          birthdayBonus: 200,
          anniversaryBonus: 100,
        },
      };

      loyaltyTierRepository.findOne.mockResolvedValue(null);
      loyaltyTierRepository.create.mockReturnValue(createDto as any);
      loyaltyTierRepository.save.mockResolvedValue({ id: 'gold-id', ...createDto });

      const result = await service.createLoyaltyTier(createDto);
      expect(result).toEqual({ id: 'gold-id', ...createDto });
    });

    it('should throw error if tier already exists', async () => {
      const createDto = {
        tierName: LoyaltyTierName.BRONZE,
        displayName: 'Bronze Member',
        minPoints: 0,
        benefits: {
          pointsMultiplier: 1,
          discountPercentage: 0,
          freeShippingThreshold: 50,
          exclusiveAccess: [],
          birthdayBonus: 50,
          anniversaryBonus: 25,
        },
      };

      loyaltyTierRepository.findOne.mockResolvedValue(mockBronzeTier);

      await expect(service.createLoyaltyTier(createDto))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('getAllLoyaltyTiers', () => {
    it('should return all active tiers ordered by sort order', async () => {
      const mockTiers = [mockBronzeTier, mockSilverTier];
      loyaltyTierRepository.find.mockResolvedValue(mockTiers);

      const result = await service.getAllLoyaltyTiers();
      expect(result).toEqual(mockTiers);
      expect(loyaltyTierRepository.find).toHaveBeenCalledWith({
        where: { isActive: true },
        order: { sortOrder: 'ASC', minPoints: 'ASC' },
      });
    });
  });

  describe('getUserLoyaltyTier', () => {
    it('should return existing user loyalty tier', async () => {
      userLoyaltyTierRepository.findOne.mockResolvedValue({
        ...mockUserLoyaltyTier,
        currentTier: mockBronzeTier,
      });

      const result = await service.getUserLoyaltyTier(mockUserId);
      expect(result).toEqual({
        ...mockUserLoyaltyTier,
        currentTier: mockBronzeTier,
      });
    });

    it('should create new user loyalty tier if none exists', async () => {
      userLoyaltyTierRepository.findOne.mockResolvedValue(null);
      loyaltyTierRepository.findOne.mockResolvedValue(mockBronzeTier);
      userLoyaltyTierRepository.create.mockReturnValue(mockUserLoyaltyTier);
      userLoyaltyTierRepository.save.mockResolvedValue(mockUserLoyaltyTier);

      const result = await service.getUserLoyaltyTier(mockUserId);
      expect(result).toEqual(mockUserLoyaltyTier);
    });

    it('should throw error if bronze tier not found during initialization', async () => {
      userLoyaltyTierRepository.findOne.mockResolvedValue(null);
      loyaltyTierRepository.findOne.mockResolvedValue(null);

      await expect(service.getUserLoyaltyTier(mockUserId))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('updateUserLoyaltyPoints', () => {
    it('should update user points and check for tier upgrade', async () => {
      const mockUserTier = {
        ...mockUserLoyaltyTier,
        currentTier: mockBronzeTier,
        updatePoints: jest.fn(),
        calculateProgressToNextTier: jest.fn(),
      };

      userLoyaltyTierRepository.findOne.mockResolvedValue(mockUserTier);
      userLoyaltyTierRepository.save.mockResolvedValue(mockUserTier);
      loyaltyTierRepository.find.mockResolvedValue([mockBronzeTier, mockSilverTier]);

      const result = await service.updateUserLoyaltyPoints(mockUserId, 100);

      expect(mockUserTier.updatePoints).toHaveBeenCalledWith(100);
      expect(result).toEqual(mockUserTier);
    });
  });

  describe('calculatePointsWithMultiplier', () => {
    it('should calculate points with tier multiplier', async () => {
      const mockUserTier = {
        ...mockUserLoyaltyTier,
        currentTier: mockSilverTier,
      };

      userLoyaltyTierRepository.findOne.mockResolvedValue(mockUserTier);

      const result = await service.calculatePointsWithMultiplier(mockUserId, 100);
      expect(result).toBe(120); // 100 * 1.2
    });
  });

  describe('calculateTierDiscount', () => {
    it('should calculate tier-based discount', async () => {
      const mockUserTier = {
        ...mockUserLoyaltyTier,
        currentTier: mockSilverTier,
      };

      userLoyaltyTierRepository.findOne.mockResolvedValue(mockUserTier);

      const result = await service.calculateTierDiscount(mockUserId, 100);
      expect(result).toBe(5); // 5% of 100
    });
  });

  describe('hasFreeShipping', () => {
    it('should check free shipping eligibility', async () => {
      const mockUserTier = {
        ...mockUserLoyaltyTier,
        currentTier: mockBronzeTier,
      };

      userLoyaltyTierRepository.findOne.mockResolvedValue(mockUserTier);

      const result = await service.hasFreeShipping(mockUserId, 60);
      expect(result).toBe(true); // 60 >= 50 threshold
    });

    it('should return false for orders below threshold', async () => {
      const mockUserTier = {
        ...mockUserLoyaltyTier,
        currentTier: mockBronzeTier,
      };

      userLoyaltyTierRepository.findOne.mockResolvedValue(mockUserTier);

      const result = await service.hasFreeShipping(mockUserId, 30);
      expect(result).toBe(false); // 30 < 50 threshold
    });
  });

  describe('initializeDefaultTiers', () => {
    it('should initialize default tiers if none exist', async () => {
      loyaltyTierRepository.count.mockResolvedValue(0);
      loyaltyTierRepository.save.mockResolvedValue([]);

      await service.initializeDefaultTiers();

      expect(loyaltyTierRepository.save).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            tierName: LoyaltyTierName.BRONZE,
            displayName: 'Bronze Member',
          }),
          expect.objectContaining({
            tierName: LoyaltyTierName.SILVER,
            displayName: 'Silver Member',
          }),
        ])
      );
    });

    it('should not initialize if tiers already exist', async () => {
      loyaltyTierRepository.count.mockResolvedValue(5);

      await service.initializeDefaultTiers();

      expect(loyaltyTierRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('grantBirthdayBonus', () => {
    it('should grant birthday bonus points', async () => {
      const mockUserTier = {
        ...mockUserLoyaltyTier,
        currentTier: mockBronzeTier,
      };

      userLoyaltyTierRepository.findOne.mockResolvedValue(mockUserTier);
      userLoyaltyTierRepository.save.mockResolvedValue(mockUserTier);

      const result = await service.grantBirthdayBonus(mockUserId);
      expect(result).toBe(50); // Bronze tier birthday bonus
    });
  });
});
