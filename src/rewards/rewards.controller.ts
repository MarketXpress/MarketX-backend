import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { RewardsService } from './rewards.service';
import { CreateRewardDto } from './dto/create-reward.dto';
import { RedeemPointsDto } from './dto/redeem-points.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('rewards')
@UseGuards(JwtAuthGuard)
export class RewardsController {
  constructor(private readonly rewardsService: RewardsService) {}

  @Get('balance')
  async getBalance(@Request() req): Promise<{ balance: number }> {
    const balance = await this.rewardsService.getUserBalance(req.user.userId);
    return { balance };
  }

  @Get('history')
  async getHistory(@Request() req) {
    return await this.rewardsService.getUserRewardsHistory(req.user.userId);
  }

  @Post('redeem')
  @HttpCode(HttpStatus.OK)
  async redeemPoints(
    @Request() req,
    @Body() redeemPointsDto: RedeemPointsDto,
  ) {
    return await this.rewardsService.redeemPoints(req.user.userId, redeemPointsDto);
  }

  @Post('checkout')
  @HttpCode(HttpStatus.OK)
  async applyPointsToCheckout(
    @Request() req,
    @Body() body: { pointsToUse: number; orderTotal: number },
  ) {
    return await this.rewardsService.applyPointsToCheckout(
      req.user.userId,
      body.pointsToUse,
      body.orderTotal,
    );
  }

  @Get('loyalty-summary')
  async getLoyaltySummary(@Request() req) {
    return await this.rewardsService.getUserLoyaltySummary(req.user.userId);
  }

  @Post('calculate-tier-discount')
  @HttpCode(HttpStatus.OK)
  async calculateTierDiscount(
    @Request() req,
    @Body() body: { orderTotal: number },
  ) {
    const discount = await this.rewardsService.calculateTierDiscount(
      req.user.userId,
      body.orderTotal,
    );
    return { tierDiscount: discount };
  }

  @Post('check-free-shipping')
  @HttpCode(HttpStatus.OK)
  async checkFreeShipping(
    @Request() req,
    @Body() body: { orderTotal: number },
  ) {
    const hasFreeShipping = await this.rewardsService.hasFreeShipping(
      req.user.userId,
      body.orderTotal,
    );
    return { hasFreeShipping };
  }

  @Post('birthday-bonus')
  @HttpCode(HttpStatus.OK)
  async grantBirthdayBonus(@Request() req) {
    return await this.rewardsService.grantBirthdayBonus(req.user.userId);
  }

  @Post('anniversary-bonus')
  @HttpCode(HttpStatus.OK)
  async grantAnniversaryBonus(@Request() req) {
    return await this.rewardsService.grantAnniversaryBonus(req.user.userId);
  }
}
