import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { LoyaltyTier, LoyaltyTierName } from './entities/loyalty-tier.entity';
import { UserLoyaltyTier } from './entities/user-loyalty-tier.entity';
import { CreateLoyaltyTierDto, UpdateLoyaltyTierDto, UserLoyaltySummaryDto } from './dto/loyalty-tier.dto';
import { RewardPoints } from './entities/reward-points.entity';

@Injectable()
export class LoyaltyService {
  constructor(
    @InjectRepository(LoyaltyTier)
    private loyaltyTierRepository: Repository<LoyaltyTier>,
    @InjectRepository(UserLoyaltyTier)
    private userLoyaltyTierRepository: Repository<UserLoyaltyTier>,
    @InjectRepository(RewardPoints)
    private rewardPointsRepository: Repository<RewardPoints>,
  ) {}

  async createLoyaltyTier(createDto: CreateLoyaltyTierDto): Promise<LoyaltyTier> {
    const existingTier = await this.loyaltyTierRepository.findOne({
      where: { tierName: createDto.tierName },
    });

    if (existingTier) {
      throw new BadRequestException(`Loyalty tier ${createDto.tierName} already exists`);
    }

    const tier = this.loyaltyTierRepository.create(createDto);
    return await this.loyaltyTierRepository.save(tier);
  }

  async getAllLoyaltyTiers(): Promise<LoyaltyTier[]> {
    return await this.loyaltyTierRepository.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC', minPoints: 'ASC' },
    });
  }

  async getLoyaltyTierById(id: string): Promise<LoyaltyTier> {
    const tier = await this.loyaltyTierRepository.findOne({
      where: { id, isActive: true },
    });

    if (!tier) {
      throw new NotFoundException('Loyalty tier not found');
    }

    return tier;
  }

  async updateLoyaltyTier(id: string, updateDto: UpdateLoyaltyTierDto): Promise<LoyaltyTier> {
    const tier = await this.getLoyaltyTierById(id);
    
    Object.assign(tier, updateDto);
    return await this.loyaltyTierRepository.save(tier);
  }

  async initializeDefaultTiers(): Promise<void> {
    const existingTiers = await this.loyaltyTierRepository.count();
    if (existingTiers > 0) {
      return; // Tiers already exist
    }

    const defaultTiers = [
      {
        tierName: LoyaltyTierName.BRONZE,
        displayName: 'Bronze Member',
        description: 'Welcome to the loyalty program',
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
        sortOrder: 1,
      },
      {
        tierName: LoyaltyTierName.SILVER,
        displayName: 'Silver Member',
        description: 'Enhanced rewards and benefits',
        minPoints: 1000,
        maxPoints: 4999,
        benefits: {
          pointsMultiplier: 1.2,
          discountPercentage: 5,
          freeShippingThreshold: 35,
          exclusiveAccess: ['early_sales', 'silver_events'],
          birthdayBonus: 100,
          anniversaryBonus: 50,
        },
        color: '#C0C0C0',
        sortOrder: 2,
      },
      {
        tierName: LoyaltyTierName.GOLD,
        displayName: 'Gold Member',
        description: 'Premium rewards and exclusive access',
        minPoints: 5000,
        maxPoints: 14999,
        benefits: {
          pointsMultiplier: 1.5,
          discountPercentage: 10,
          freeShippingThreshold: 25,
          exclusiveAccess: ['early_sales', 'silver_events', 'gold_events'],
          birthdayBonus: 200,
          anniversaryBonus: 100,
        },
        color: '#FFD700',
        sortOrder: 3,
      },
      {
        tierName: LoyaltyTierName.PLATINUM,
        displayName: 'Platinum Member',
        description: 'Elite status with maximum benefits',
        minPoints: 15000,
        maxPoints: 49999,
        benefits: {
          pointsMultiplier: 2,
          discountPercentage: 15,
          freeShippingThreshold: 0,
          exclusiveAccess: ['early_sales', 'silver_events', 'gold_events', 'platinum_events'],
          birthdayBonus: 500,
          anniversaryBonus: 250,
        },
        color: '#E5E4E2',
        sortOrder: 4,
      },
      {
        tierName: LoyaltyTierName.DIAMOND,
        displayName: 'Diamond Member',
        description: 'Ultimate loyalty experience',
        minPoints: 50000,
        benefits: {
          pointsMultiplier: 2.5,
          discountPercentage: 20,
          freeShippingThreshold: 0,
          exclusiveAccess: ['early_sales', 'silver_events', 'gold_events', 'platinum_events', 'diamond_events'],
          birthdayBonus: 1000,
          anniversaryBonus: 500,
        },
        color: '#B9F2FF',
        sortOrder: 5,
      },
    ];

    await this.loyaltyTierRepository.save(defaultTiers);
  }

  async getUserLoyaltyTier(userId: string): Promise<UserLoyaltyTier> {
    let userTier = await this.userLoyaltyTierRepository.findOne({
      where: { userId },
      relations: ['currentTier'],
    });

    if (!userTier) {
      // Initialize user with Bronze tier
      const bronzeTier = await this.loyaltyTierRepository.findOne({
        where: { tierName: LoyaltyTierName.BRONZE },
      });

      if (!bronzeTier) {
        throw new NotFoundException('Bronze tier not found. Please initialize default tiers first.');
      }

      userTier = this.userLoyaltyTierRepository.create({
        userId,
        currentTierId: bronzeTier.id,
        lifetimePoints: 0,
        currentYearPoints: 0,
        monthsAtCurrentTier: 0,
        lastActivityDate: new Date(),
      });

      userTier = await this.userLoyaltyTierRepository.save(userTier);
    }

    return userTier;
  }

  async updateUserLoyaltyPoints(userId: string, points: number): Promise<UserLoyaltyTier> {
    const userTier = await this.getUserLoyaltyTier(userId);
    
    userTier.updatePoints(points);
    
    // Check for tier upgrade
    await this.checkAndProcessTierUpgrade(userTier);
    
    return await this.userLoyaltyTierRepository.save(userTier);
  }

  private async checkAndProcessTierUpgrade(userTier: UserLoyaltyTier): Promise<void> {
    const allTiers = await this.getAllLoyaltyTiers();
    
    // Find the highest tier the user qualifies for
    let eligibleTier = null;
    for (const tier of allTiers) {
      if (tier.isInRange(userTier.lifetimePoints)) {
        eligibleTier = tier;
      }
    }

    if (eligibleTier && eligibleTier.id !== userTier.currentTierId) {
      // Process tier upgrade
      userTier.currentTierId = eligibleTier.id;
      userTier.tierUpgradeDate = new Date();
      userTier.monthsAtCurrentTier = 0;
      userTier.currentTier = eligibleTier;
    }

    // Update progress to next tier
    const currentTierIndex = allTiers.findIndex(t => t.id === userTier.currentTierId);
    const nextTier = allTiers[currentTierIndex + 1];
    
    if (nextTier) {
      userTier.calculateProgressToNextTier(nextTier);
    } else {
      userTier.tierProgress = null; // User is at highest tier
    }
  }

  async getUserLoyaltySummary(userId: string): Promise<UserLoyaltySummaryDto> {
    const userTier = await this.getUserLoyaltyTier(userId);
    
    return {
      currentTier: userTier.currentTier.tierName,
      currentTierDisplayName: userTier.currentTier.displayName,
      lifetimePoints: userTier.lifetimePoints,
      currentYearPoints: userTier.currentYearPoints,
      tierProgress: userTier.tierProgress,
      currentBenefits: userTier.currentTier.benefits,
      monthsAtCurrentTier: userTier.monthsAtCurrentTier,
    };
  }

  async calculatePointsWithMultiplier(userId: string, basePoints: number): Promise<number> {
    const userTier = await this.getUserLoyaltyTier(userId);
    return userTier.currentTier.calculatePointsEarned(basePoints);
  }

  async calculateTierDiscount(userId: string, orderAmount: number): Promise<number> {
    const userTier = await this.getUserLoyaltyTier(userId);
    return userTier.currentTier.calculateDiscount(orderAmount);
  }

  async hasFreeShipping(userId: string, orderAmount: number): Promise<boolean> {
    const userTier = await this.getUserLoyaltyTier(userId);
    return userTier.currentTier.hasFreeShipping(orderAmount);
  }

  async grantBirthdayBonus(userId: string): Promise<number> {
    const userTier = await this.getUserLoyaltyTier(userId);
    const bonusPoints = userTier.currentTier.benefits.birthdayBonus;
    
    if (bonusPoints > 0) {
      await this.updateUserLoyaltyPoints(userId, bonusPoints);
    }
    
    return bonusPoints;
  }

  async grantAnniversaryBonus(userId: string): Promise<number> {
    const userTier = await this.getUserLoyaltyTier(userId);
    const bonusPoints = userTier.currentTier.benefits.anniversaryBonus;
    
    if (bonusPoints > 0) {
      await this.updateUserLoyaltyPoints(userId, bonusPoints);
    }
    
    return bonusPoints;
  }
}
