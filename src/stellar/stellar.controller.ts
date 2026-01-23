import { Controller, Post, Get, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { StellarService } from './stellar.service';
import {
  CreateWalletDto,
  ValidateAddressDto,
  GetBalanceDto,
  FundTestnetDto,
  WalletResponseDto,
  BalanceResponseDto,
} from './dto/wallet.dto';

@ApiTags('stellar')
@Controller('stellar')
export class StellarController {
  constructor(private readonly stellarService: StellarService) {}

  @Post('wallet/create')
  @ApiOperation({ summary: 'Create a new Stellar wallet' })
  @ApiResponse({ status: 201, description: 'Wallet created successfully', type: WalletResponseDto })
  async createWallet(@Body() createWalletDto: CreateWalletDto): Promise<WalletResponseDto> {
    return this.stellarService.createWallet();
  }

  @Post('wallet/validate')
  @ApiOperation({ summary: 'Validate a Stellar address' })
  @ApiResponse({ status: 200, description: 'Address validation result' })
  async validateAddress(@Body() validateAddressDto: ValidateAddressDto) {
    return this.stellarService.validateAddress(validateAddressDto);
  }

  @Get('wallet/balance/:publicKey')
  @ApiOperation({ summary: 'Get balance for a Stellar account' })
  @ApiResponse({ status: 200, description: 'Balance retrieved successfully', type: BalanceResponseDto })
  async getBalance(@Param('publicKey') publicKey: string): Promise<BalanceResponseDto> {
    return this.stellarService.getBalance(publicKey);
  }

  @Get('wallet/exists/:publicKey')
  @ApiOperation({ summary: 'Check if account exists on the network' })
  @ApiResponse({ status: 200, description: 'Account existence check result' })
  async accountExists(@Param('publicKey') publicKey: string): Promise<{ exists: boolean }> {
    const exists = await this.stellarService.accountExists(publicKey);
    return { exists };
  }

  @Post('wallet/fund-testnet')
  @ApiOperation({ summary: 'Fund a testnet account (testnet only)' })
  @ApiResponse({ status: 200, description: 'Account funded successfully' })
  async fundTestnetAccount(@Body() fundTestnetDto: FundTestnetDto) {
    return this.stellarService.fundTestnetAccount(fundTestnetDto.publicKey);
  }

  @Get('network/info')
  @ApiOperation({ summary: 'Get current network information' })
  @ApiResponse({ status: 200, description: 'Network info retrieved' })
  getNetworkInfo() {
    return this.stellarService.getNetworkInfo();
  }
}