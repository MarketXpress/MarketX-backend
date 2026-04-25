import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RewardPoints, PointsTransactionType } from './entities/reward-points.entity';
import { CreateRewardDto } from './dto/create-reward.dto';
import { RedeemPointsDto } from './dto/redeem-points.dto';
import { Coupon } from '../coupons/entities/coupon.entity';
import { DiscountType } from '../coupons/entities/coupon.entity';

@Injectable()
export class RewardsService {
  private readonly POINTS_PER_DOLLAR = 10;
  private readonly POINTS_TO_DOLLAR_CONVERSION = 100; // 100 points = $1

  constructor(
    @InjectRepository(RewardPoints)
    private rewardsRepository: Repository<RewardPoints>,
    @InjectRepository(Coupon)
    private couponsRepository: Repository<Coupon>,
  ) {}

  async getUserBalance(userId: string): Promise<number> {
    const result = await this.rewardsRepository
      .createQueryBuilder('reward')
      .select('SUM(reward.points)', 'total')
      .where('reward.userId = :userId', { userId })
      .andWhere('reward.deletedAt IS NULL')
      .getRawOne();

    return result?.total || 0;
  }

  async getUserRewardsHistory(userId: string): Promise<RewardPoints[]> {
    return await this.rewardsRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      relations: ['user'],
    });
  }

  async createReward(createRewardDto: CreateRewardDto): Promise<RewardPoints> {
    const currentBalance = await this.getUserBalance(createRewardDto.userId);
    const newBalance = currentBalance + createRewardDto.points;

    if (createRewardDto.transactionType === PointsTransactionType.REDEEMED) {
      if (currentBalance < createRewardDto.points) {
        throw new BadRequestException('Insufficient reward points balance');
      }
    }

    const reward = this.rewardsRepository.create({
      ...createRewardDto,
      balanceAfter: newBalance,
      transactionType: createRewardDto.transactionType || PointsTransactionType.EARNED,
    });

    return await this.rewardsRepository.save(reward);
  }

  async grantPointsForOrder(
    userId: string,
    orderId: string,
    totalAmount: number,
  ): Promise<RewardPoints> {
    const pointsEarned = Math.floor(totalAmount * this.POINTS_PER_DOLLAR);

    if (pointsEarned <= 0) {
      throw new BadRequestException('Order amount must be greater than zero to earn points');
    }

    return await this.createReward({
      userId,
      points: pointsEarned,
      transactionType: PointsTransactionType.EARNED,
      description: `Points earned for order ${orderId}`,
      referenceId: orderId,
      referenceType: 'order',
    });
  }

  async redeemPoints(
    userId: string,
    redeemPointsDto: RedeemPointsDto,
  ): Promise<{ coupon: Coupon; pointsUsed: number; remainingBalance: number }> {
    const currentBalance = await this.getUserBalance(userId);

    if (currentBalance < redeemPointsDto.points) {
      throw new BadRequestException('Insufficient reward points balance');
    }

    const discountValue = redeemPointsDto.points / this.POINTS_TO_DOLLAR_CONVERSION;

    // Create a coupon for the user
    const coupon = this.couponsRepository.create({
      code: `REWARD-${Date.now()}-${userId.substring(0, 8)}`,
      name: 'Reward Points Redemption',
      description: `Redeemed ${redeemPointsDto.points} reward points`,
      discountType: DiscountType.FIXED_AMOUNT,
      discountValue: discountValue,
      status: 'active',
      totalUsageLimit: 1,
      perUserLimit: 1,
      currentUsageCount: 0,
      restrictions: {
        minimumOrderAmount: 0,
      },
    });

    const savedCoupon = await this.couponsRepository.save(coupon);

    // Deduct points
    await this.createReward({
      userId,
      points: -redeemPointsDto.points,
      transactionType: PointsTransactionType.REDEEMED,
      description: `Redeemed points for coupon ${savedCoupon.code}`,
      referenceId: savedCoupon.id,
      referenceType: 'coupon',
    });

    const remainingBalance = await this.getUserBalance(userId);

    return {
      coupon: savedCoupon,
      pointsUsed: redeemPointsDto.points,
      remainingBalance,
    };
  }

  async applyPointsToCheckout(
    userId: string,
    pointsToUse: number,
    orderTotal: number,
  ): Promise<{ discountAmount: number; pointsUsed: number; remainingBalance: number }> {
    const currentBalance = await this.getUserBalance(userId);

    if (currentBalance < pointsToUse) {
      throw new BadRequestException('Insufficient reward points balance');
    }

    const maxDiscountFromPoints = pointsToUse / this.POINTS_TO_DOLLAR_CONVERSION;
    const discountAmount = Math.min(maxDiscountFromPoints, orderTotal);

    const actualPointsUsed = Math.floor(discountAmount * this.POINTS_TO_DOLLAR_CONVERSION);

    // Deduct points
    await this.createReward({
      userId,
      points: -actualPointsUsed,
      transactionType: PointsTransactionType.REDEEMED,
      description: `Applied ${actualPointsUsed} points to checkout`,
      referenceType: 'checkout',
    });

    const remainingBalance = await this.getUserBalance(userId);

    return {
      discountAmount,
      pointsUsed: actualPointsUsed,
      remainingBalance,
    };
  }

  async adjustPoints(
    userId: string,
    points: number,
    description: string,
    referenceId?: string,
  ): Promise<RewardPoints> {
    return await this.createReward({
      userId,
      points,
      transactionType: PointsTransactionType.ADJUSTED,
      description,
      referenceId,
      referenceType: 'admin_adjustment',
    });
  }
}
