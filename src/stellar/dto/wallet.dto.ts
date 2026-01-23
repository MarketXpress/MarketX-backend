import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateWalletDto {
  @ApiProperty({ required: false, description: 'Optional label for the wallet' })
  @IsOptional()
  @IsString()
  label?: string;
}

export class ValidateAddressDto {
  @ApiProperty({ description: 'Stellar public key to validate' })
  @IsNotEmpty()
  @IsString()
  address: string;
}

export class GetBalanceDto {
  @ApiProperty({ description: 'Stellar public key' })
  @IsNotEmpty()
  @IsString()
  publicKey: string;
}

export class FundTestnetDto {
  @ApiProperty({ description: 'Stellar public key to fund on testnet' })
  @IsNotEmpty()
  @IsString()
  publicKey: string;
}

export class WalletResponseDto {
  @ApiProperty({ description: 'Public key (address)' })
  publicKey: string;

  @ApiProperty({ description: 'Secret key (KEEP SECURE!)' })
  secretKey: string;

  @ApiProperty({ description: 'Network (testnet or mainnet)' })
  network: string;

  @ApiProperty({ description: 'Response message' })
  message: string;
}

export class BalanceResponseDto {
  @ApiProperty({ description: 'Public key' })
  publicKey: string;

  @ApiProperty({ description: 'Whether account exists' })
  exists: boolean;

  @ApiProperty({ description: 'Account balances' })
  balances: BalanceInfo[];

  @ApiProperty({ description: 'Response message' })
  message: string;
}

export class BalanceInfo {
  @ApiProperty({ description: 'Asset type' })
  asset_type: string;

  @ApiProperty({ description: 'Asset code (e.g., XLM)' })
  asset_code: string;

  @ApiProperty({ description: 'Asset issuer', nullable: true })
  asset_issuer: string | null;

  @ApiProperty({ description: 'Balance amount' })
  balance: string;
}