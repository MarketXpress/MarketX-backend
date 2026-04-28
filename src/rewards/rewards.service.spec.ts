import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RewardsService } from './rewards.service';
import { LoyaltyService } from './loyalty.service';
import { RewardPoints, PointsTransactionType } from './entities/reward-points.entity';
import { Coupon } from '../coupons/entities/coupon.entity';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('RewardsService', () => {
  let service: RewardsService;
  let rewardsRepository: jest.Mocked<Repository<RewardPoints>>;
  let couponsRepository: jest.Mocked<Repository<Coupon>>;
  let loyaltyService: jest.Mocked<LoyaltyService>;

  const mockUser = { id: 'user-123', email: 'test@example.com' };

  const mockRewardPoints: RewardPoints = {
    id: 'reward-123',
    userId: mockUser.id,
    points: 100,
    transactionType: PointsTransactionType.EARNED,
    description: 'Test reward',
    balanceAfter: 100,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCoupon: Coupon = {
    id: 'coupon-123',
    code: 'TEST-COUPON',
    name: 'Test Coupon',
    description: 'Test description',
    discountType: 'fixed_amount' as any,
    discountValue: 10,
    status: 'active' as any,
    totalUsageLimit: 1,
    perUserLimit: 1,
    currentUsageCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockRewardsRepository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const mockCouponsRepository = {
      create: jest.fn(),
      save: jest.fn(),
    };

    const mockLoyaltyService = {
      calculatePointsWithMultiplier: jest.fn(),
      updateUserLoyaltyPoints: jest.fn(),
      getUserLoyaltySummary: jest.fn(),
      calculateTierDiscount: jest.fn(),
      hasFreeShipping: jest.fn(),
      grantBirthdayBonus: jest.fn(),
      grantAnniversaryBonus: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RewardsService,
        {
          provide: getRepositoryToken(RewardPoints),
          useValue: mockRewardsRepository,
        },
        {
          provide: getRepositoryToken(Coupon),
          useValue: mockCouponsRepository,
        },
        {
          provide: LoyaltyService,
          useValue: mockLoyaltyService,
        },
      ],
    }).compile();

    service = module.get<RewardsService>(RewardsService);
    rewardsRepository = module.get(getRepositoryToken(RewardPoints));
    couponsRepository = module.get(getRepositoryToken(Coupon));
    loyaltyService = module.get(LoyaltyService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getUserBalance', () => {
    it('should return user balance', async () => {
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ total: 250 }),
      };

      rewardsRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const balance = await service.getUserBalance(mockUser.id);
      expect(balance).toBe(250);
    });

    it('should return 0 for user with no points', async () => {
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue(null),
      };

      rewardsRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const balance = await service.getUserBalance(mockUser.id);
      expect(balance).toBe(0);
    });
  });

  describe('grantPointsForOrder', () => {
    it('should grant points with loyalty multiplier', async () => {
      const orderId = 'order-123';
      const totalAmount = 50;
      const basePoints = 500;
      const multiplierPoints = 600;

      loyaltyService.calculatePointsWithMultiplier.mockResolvedValue(multiplierPoints);
      loyaltyService.updateUserLoyaltyPoints.mockResolvedValue(undefined);

      rewardsRepository.create.mockReturnValue(mockRewardPoints);
      rewardsRepository.save.mockResolvedValue(mockRewardPoints);

      const result = await service.grantPointsForOrder(mockUser.id, orderId, totalAmount);

      expect(loyaltyService.calculatePointsWithMultiplier).toHaveBeenCalledWith(mockUser.id, basePoints);
      expect(loyaltyService.updateUserLoyaltyPoints).toHaveBeenCalledWith(mockUser.id, multiplierPoints);
      expect(rewardsRepository.create).toHaveBeenCalledWith({
        userId: mockUser.id,
        points: multiplierPoints,
        transactionType: PointsTransactionType.EARNED,
        description: `Points earned for order ${orderId} (includes 100 tier bonus)`,
        referenceId: orderId,
        referenceType: 'order',
      });
    });

    it('should throw error for zero amount order', async () => {
      await expect(service.grantPointsForOrder(mockUser.id, 'order-123', 0))
        .rejects.toThrow(BadException);
    });
  });

  describe('redeemPoints', () => {
    it('should redeem points for coupon', async () => {
      const pointsToRedeem = 100;
      const mockBalance = 200;

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ total: mockBalance }),
      };

      rewardsRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);
      couponsRepository.create.mockReturnValue(mockCoupon);
      couponsRepository.save.mockResolvedValue(mockCoupon);

      rewardsRepository.create.mockReturnValue(mockRewardPoints);
      rewardsRepository.save.mockResolvedValue(mockRewardPoints);

      const result = await service.redeemPoints(mockUser.id, { points: pointsToRedeem });

      expect(result).toEqual({
        coupon: mockCoupon,
        pointsUsed: pointsToRedeem,
        remainingBalance: mockBalance,
      });
    });

    it('should throw error for insufficient balance', async () => {
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ total: 50 }),
      };

      rewardsRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      await expect(service.redeemPoints(mockUser.id, { points: 100 }))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('applyPointsToCheckout', () => {
    it('should apply points to checkout', async () => {
      const pointsToUse = 100;
      const orderTotal = 50;
      const mockBalance = 200;

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn()
          .mockResolvedValueOnce({ total: mockBalance })
          .mockResolvedValueOnce({ total: mockBalance - pointsToUse }),
      };

      rewardsRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);
      rewardsRepository.create.mockReturnValue(mockRewardPoints);
      rewardsRepository.save.mockResolvedValue(mockRewardPoints);

      const result = await service.applyPointsToCheckout(mockUser.id, pointsToUse, orderTotal);

      expect(result.discountAmount).toBe(1); // 100 points = $1
      expect(result.pointsUsed).toBe(100);
      expect(result.remainingBalance).toBe(mockBalance - pointsToUse);
    });
  });

  describe('loyalty integration', () => {
    it('should get user loyalty summary', async () => {
      const mockSummary = {
        currentTier: 'silver',
        currentTierDisplayName: 'Silver Member',
        lifetimePoints: 1500,
        currentYearPoints: 800,
      };

      loyaltyService.getUserLoyaltySummary.mockResolvedValue(mockSummary);

      const result = await service.getUserLoyaltySummary(mockUser.id);
      expect(result).toEqual(mockSummary);
    });

    it('should calculate tier discount', async () => {
      const orderTotal = 100;
      const expectedDiscount = 5; // 5% for silver tier

      loyaltyService.calculateTierDiscount.mockResolvedValue(expectedDiscount);

      const result = await service.calculateTierDiscount(mockUser.id, orderTotal);
      expect(result).toBe(expectedDiscount);
    });

    it('should check free shipping eligibility', async () => {
      const orderTotal = 30;
      loyaltyService.hasFreeShipping.mockResolvedValue(true);

      const result = await service.hasFreeShipping(mockUser.id, orderTotal);
      expect(result).toBe(true);
    });
  });
});
