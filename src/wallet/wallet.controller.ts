import { Controller, Get, Post, Body, Patch, Param, Delete, Req, UseGuards, HttpException, HttpStatus } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { CreateWalletDto } from './dto/create-wallet.dto';
import { UpdateWalletDto } from './dto/update-wallet.dto';

@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  // GET /wallet/balance
  @Get('balance')
  @UseGuards(require('../auth/guards/jwt-auth.guard').JwtAuthGuard)
  async getWalletBalance(@Req() req) {
    const user = req.user;
    if (!user || !user.userId) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    try {
      const balance = await this.walletService.getWalletBalance(user.userId);
      return balance;
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to fetch wallet balance',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // PATCH /wallet/regenerate
  @Patch('regenerate')
  @UseGuards(require('../auth/guards/jwt-auth.guard').JwtAuthGuard)
  async regenerateWalletKeys(@Req() req) {
    // Enforce authentication (JWT guard ensures user is authenticated)
    const user = req.user;
    if (!user || !user.userId) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }
    // Optionally: Enforce 2FA here if implemented

    try {
      const wallet = await this.walletService.regenerateWalletKeys(user.userId);
      return { message: 'Wallet keys regenerated successfully', wallet };
    } catch (error) {
      throw new HttpException(error.message || 'Wallet regeneration failed', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
