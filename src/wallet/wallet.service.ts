import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { Wallet } from './entities/wallet.entity';
import { WalletKeyAudit } from './entities/wallet-key-audit.entity';
import * as StellarSdk from '@stellar/stellar-sdk';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(Wallet)
    private walletRepository: Repository<Wallet>,
    private configService: ConfigService,
    @InjectRepository(WalletKeyAudit)
    private walletKeyAuditRepository: Repository<WalletKeyAudit>,
  ) {}

  generateKeyPair(): { publicKey: string; secretKey: string } {
    const secretKey = crypto.randomBytes(32).toString('hex');
    const publicKey = crypto.createHash('sha256').update(secretKey).digest('hex');
    return { publicKey, secretKey };
  }

  async createWalletForUser(user: any): Promise<Wallet> {
    const { publicKey, secretKey } = this.generateKeyPair();

    const encryptedSecret = this.encrypt(secretKey);

    const wallet = this.walletRepository.create({
      publicKey,
      secretKey: encryptedSecret,
      user,
    });

    return this.walletRepository.save(wallet);
  }

  async findByUserId(userId: string) {
    return this.walletRepository.findOne({
      where: { userId },
      relations: ['user'],
    });
  }
  
  

  private encrypt(text: string): string {
    const key = this.configService.get<string>('SECRET_KEY');
    if (!key) {
      throw new Error('SECRET_KEY is not defined in environment variables');
    }
  
    const cipher = crypto.createCipheriv('aes-256-ctr', key.slice(0, 32), Buffer.alloc(16, 0));
    return Buffer.concat([cipher.update(text), cipher.final()]).toString('hex');
  }

  /**
   * Regenerate wallet keys for a user, securely replacing old keys and logging the previous keys in an audit table.
   * @param userId - The ID of the user whose wallet keys are to be regenerated
   * @returns The updated wallet entity
   */
  async regenerateWalletKeys(userId: string): Promise<Wallet> {
    // Find the user's wallet
    const wallet = await this.findByUserId(userId);
    if (!wallet) {
      throw new Error('Wallet not found for user');
    }

    // Log previous keys in audit table
    await this.walletKeyAuditRepository.save({
      userId,
      oldPublicKey: wallet.publicKey,
      oldSecretKey: wallet.secretKey, // already encrypted
    });

    // Generate new keys
    const { publicKey, secretKey } = this.generateKeyPair();
    const encryptedSecret = this.encrypt(secretKey);

    // Update wallet with new keys
    wallet.publicKey = publicKey;
    wallet.secretKey = encryptedSecret;
    await this.walletRepository.save(wallet);

    return wallet;
  }

  /**
   * Sync all wallet balances from the Stellar blockchain.
   */
  async syncAllWalletBalances(): Promise<void> {
    const server = new StellarSdk.Horizon.Server('https://horizon.stellar.org');
    const wallets = await this.walletRepository.find();
    for (const wallet of wallets) {
      try {
        const account = await server.loadAccount(wallet.publicKey);
        // Find XLM balance (native asset)
        const nativeBalance = account.balances.find(b => b.asset_type === 'native');
        if (nativeBalance) {
          // If you have a balance column, update it; otherwise, log it
          // wallet.balance = nativeBalance.balance;
          // await this.walletRepository.save(wallet);
          console.log(`Wallet ${wallet.id} synced. Balance: ${nativeBalance.balance}`);
        }
      } catch (error) {
        console.error(`Failed to sync wallet ${wallet.id}:`, error.message);
      }
    }
  }

  /**
   * Get the wallet balance for a user
   * @param userId - The ID of the user whose wallet balance is to be fetched
   * @returns Object containing balance, currency, and publicKey
   */
  async getWalletBalance(userId: string): Promise<{ balance: string; currency: string; publicKey: string }> {
    const wallet = await this.findByUserId(userId);
    if (!wallet) {
      throw new Error('Wallet not found for user');
    }

    const server = new StellarSdk.Horizon.Server('https://horizon.stellar.org');
    try {
      const account = await server.loadAccount(wallet.publicKey);
      // Find XLM balance (native asset)
      const nativeBalance = account.balances.find(b => b.asset_type === 'native');
      
      if (!nativeBalance) {
        throw new Error('No balance found for wallet');
      }

      return {
        balance: nativeBalance.balance,
        currency: 'XLM',
        publicKey: wallet.publicKey
      };
    } catch (error) {
      if (error.response?.status === 404) {
        throw new Error('Wallet not found on Stellar network');
      }
      throw new Error(`Failed to fetch wallet balance: ${error.message}`);
    }
  }
}

