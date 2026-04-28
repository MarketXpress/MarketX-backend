import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { LoyaltyService } from './loyalty.service';
import { CreateLoyaltyTierDto, UpdateLoyaltyTierDto } from './dto/loyalty-tier.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../guards/admin.guard';

@Controller('loyalty')
@UseGuards(JwtAuthGuard)
export class LoyaltyController {
  constructor(private readonly loyaltyService: LoyaltyService) {}

  @Get('tiers')
  async getAllTiers() {
    return await this.loyaltyService.getAllLoyaltyTiers();
  }

  @Get('tiers/:id')
  async getTierById(@Param('id') id: string) {
    return await this.loyaltyService.getLoyaltyTierById(id);
  }

  @Post('tiers')
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.CREATED)
  async createTier(@Body() createDto: CreateLoyaltyTierDto) {
    return await this.loyaltyService.createLoyaltyTier(createDto);
  }

  @Put('tiers/:id')
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.OK)
  async updateTier(@Param('id') id: string, @Body() updateDto: UpdateLoyaltyTierDto) {
    return await this.loyaltyService.updateLoyaltyTier(id, updateDto);
  }

  @Post('initialize-default-tiers')
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.OK)
  async initializeDefaultTiers() {
    await this.loyaltyService.initializeDefaultTiers();
    return { message: 'Default loyalty tiers initialized successfully' };
  }
}
