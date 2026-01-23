import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as StellarSdk from '@stellar/stellar-sdk';
import { CreateWalletDto, WalletResponseDto, ValidateAddressDto, BalanceResponseDto } from './dto/wallet.dto';

@Injectable()
export class StellarService {
  private readonly logger = new Logger(StellarService.name);
  private server: StellarSdk.Horizon.Server;
  private network: string;

  constructor(private configService: ConfigService) {
    this.network = this.configService.get<string>('STELLAR_NETWORK', 'testnet');
    const horizonUrl = this.configService.get<string>(
      'STELLAR_HORIZON_URL',
      'https://horizon-testnet.stellar.org'
    );
    
    this.server = new StellarSdk.Horizon.Server(horizonUrl);
    
    // Set network passphrase
    if (this.network === 'testnet') {
      StellarSdk.Networks.TESTNET;
    } else {
      StellarSdk.Networks.PUBLIC;
    }
    
    this.logger.log(`Stellar service initialized with ${this.network} network`);
  }

  /**
   * Create a new Stellar wallet (keypair)
   */
  async createWallet(): Promise<WalletResponseDto> {
    try {
      const pair = StellarSdk.Keypair.random();
      
      this.logger.log(`New wallet created: ${pair.publicKey()}`);
      
      return {
        publicKey: pair.publicKey(),
        secretKey: pair.secret(),
        network: this.network,
        message: 'Wallet created successfully. Keep your secret key safe!',
      };
    } catch (error) {
      this.logger.error('Error creating wallet', error);
      throw new BadRequestException('Failed to create wallet');
    }
  }

  /**
   * Validate if a Stellar address is valid
   */
  validateAddress(dto: ValidateAddressDto): { valid: boolean; message: string } {
    try {
      const { address } = dto;
      
      // Check if it's a valid Stellar public key
      const isValid = StellarSdk.StrKey.isValidEd25519PublicKey(address);
      
      if (isValid) {
        this.logger.log(`Address validated: ${address}`);
        return {
          valid: true,
          message: 'Valid Stellar address',
        };
      } else {
        return {
          valid: false,
          message: 'Invalid Stellar address format',
        };
      }
    } catch (error) {
      this.logger.error('Error validating address', error);
      return {
        valid: false,
        message: 'Error validating address',
      };
    }
  }

  /**
   * Check if account exists on the network
   */
  async accountExists(publicKey: string): Promise<boolean> {
    try {
      await this.server.loadAccount(publicKey);
      this.logger.log(`Account exists: ${publicKey}`);
      return true;
    } catch (error) {
      if (error instanceof StellarSdk.NotFoundError) {
        this.logger.log(`Account does not exist: ${publicKey}`);
        return false;
      }
      this.logger.error('Error checking account existence', error);
      throw new BadRequestException('Failed to check account existence');
    }
  }

  /**
   * Get balance for a Stellar account
   */
  async getBalance(publicKey: string): Promise<BalanceResponseDto> {
    try {
      // Validate address first
      const validation = this.validateAddress({ address: publicKey });
      if (!validation.valid) {
        throw new BadRequestException('Invalid Stellar address');
      }

      // Check if account exists
      const exists = await this.accountExists(publicKey);
      if (!exists) {
        return {
          publicKey,
          exists: false,
          balances: [],
          message: 'Account does not exist on the network. It may need to be funded first.',
        };
      }

      // Load account details
      const account = await this.server.loadAccount(publicKey);
      
      const balances = account.balances.map((balance: any) => ({
        asset_type: balance.asset_type,
        asset_code: balance.asset_code || 'XLM',
        asset_issuer: balance.asset_issuer || null,
        balance: balance.balance,
      }));

      this.logger.log(`Retrieved balance for: ${publicKey}`);
      
      return {
        publicKey,
        exists: true,
        balances,
        message: 'Balance retrieved successfully',
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error('Error getting balance', error);
      throw new BadRequestException('Failed to retrieve balance');
    }
  }

  /**
   * Fund a testnet account (testnet only)
   */
  async fundTestnetAccount(publicKey: string): Promise<{ success: boolean; message: string }> {
    if (this.network !== 'testnet') {
      throw new BadRequestException('Funding is only available on testnet');
    }

    try {
      const validation = this.validateAddress({ address: publicKey });
      if (!validation.valid) {
        throw new BadRequestException('Invalid Stellar address');
      }

      const response = await fetch(
        `https://friendbot.stellar.org?addr=${encodeURIComponent(publicKey)}`
      );

      if (response.ok) {
        this.logger.log(`Testnet account funded: ${publicKey}`);
        return {
          success: true,
          message: 'Account funded successfully with 10,000 XLM on testnet',
        };
      } else {
        throw new Error('Friendbot request failed');
      }
    } catch (error) {
      this.logger.error('Error funding testnet account', error);
      throw new BadRequestException('Failed to fund testnet account');
    }
  }

  /**
   * Get network info
   */
  getNetworkInfo(): { network: string; horizonUrl: string } {
    return {
      network: this.network,
      horizonUrl: this.configService.get<string>('STELLAR_HORIZON_URL'),
    };
  }
}