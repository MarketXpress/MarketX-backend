import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RewardsService } from './rewards.service';
import { RewardsController } from './rewards.controller';
import { RewardPoints } from './entities/reward-points.entity';
import { Coupon } from '../coupons/entities/coupon.entity';
import { OrderCompletedListener } from './listeners/order-completed.listener';

@Module({
  imports: [TypeOrmModule.forFeature([RewardPoints, Coupon])],
  controllers: [RewardsController],
  providers: [RewardsService, OrderCompletedListener],
  exports: [RewardsService],
})
export class RewardsModule {}
