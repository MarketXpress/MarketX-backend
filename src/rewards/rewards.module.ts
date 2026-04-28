import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RewardsService } from './rewards.service';
import { RewardsController } from './rewards.controller';
import { LoyaltyService } from './loyalty.service';
import { LoyaltyController } from './loyalty.controller';
import { RewardPoints } from './entities/reward-points.entity';
import { LoyaltyTier } from './entities/loyalty-tier.entity';
import { UserLoyaltyTier } from './entities/user-loyalty-tier.entity';
import { Coupon } from '../coupons/entities/coupon.entity';
import { OrderCompletedListener } from './listeners/order-completed.listener';

@Module({
  imports: [TypeOrmModule.forFeature([RewardPoints, LoyaltyTier, UserLoyaltyTier, Coupon])],
  controllers: [RewardsController, LoyaltyController],
  providers: [RewardsService, LoyaltyService, OrderCompletedListener],
  exports: [RewardsService, LoyaltyService],
})
export class RewardsModule {}
