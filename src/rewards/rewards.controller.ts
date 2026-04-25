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
}
