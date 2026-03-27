import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Wallet } from './entities/wallet.entity';
import { WalletKeyAudit } from './entities/wallet-key-audit.entity';
import * as StellarSdk from '@stellar/stellar-sdk';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    @InjectRepository(Wallet)
    private walletRepository: Repository<Wallet>,
    private configService: ConfigService,
    @InjectRepository(WalletKeyAudit)
    private walletKeyAuditRepository: Repository<WalletKeyAudit>,
    private eventEmitter: EventEmitter2,
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

  /**
   * Request a withdrawal from user's wallet
   * Emits audit events for compliance tracking
   */
  async requestWithdrawal(
    userId: string,
    amount: number,
    destination: string,
    ipAddress: string,
    userAgent?: string,
  ): Promise<{ success: boolean; transactionId: string }> {
    try {
      if (amount <= 0) {
        throw new BadRequestException('Withdrawal amount must be positive');
      }

      const wallet = await this.findByUserId(userId);
      if (!wallet) {
        throw new BadRequestException('Wallet not found for user');
      }

      // Validate destination address format
      if (!this.isValidStellarAddress(destination)) {
        throw new BadRequestException('Invalid destination address');
      }

      // Check balance
      const { balance } = await this.getWalletBalance(userId);
      if (parseFloat(balance) < amount) {
        // Emit audit event for failed withdrawal attempt
        this.eventEmitter.emit('wallet.withdrawal_requested', {
          actionType: 'WITHDRAWAL',
          userId,
          ipAddress,
          userAgent,
          status: 'FAILURE',
          errorMessage: 'Insufficient balance',
          resourceType: 'wallet',
          resourceId: wallet.id,
          statePreviousValue: { balance: parseFloat(balance) },
          stateNewValue: { balance: parseFloat(balance) - amount },
          metadata: {
            amount,
            destination,
            currency: 'XLM',
            reason: 'insufficient_balance',
          },
        });

        throw new BadRequestException('Insufficient balance for withdrawal');
      }

      // Generate transaction ID
      const transactionId = `withdrawal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Emit audit event for successful withdrawal request
      this.eventEmitter.emit('wallet.withdrawal_requested', {
        actionType: 'WITHDRAWAL',
        userId,
        ipAddress,
        userAgent,
        status: 'SUCCESS',
        resourceType: 'wallet',
        resourceId: wallet.id,
        statePreviousValue: { balance: parseFloat(balance), withdrawn: false },
        stateNewValue: { balance: parseFloat(balance) - amount, withdrawn: true },
        metadata: {
          amount,
          destination,
          currency: 'XLM',
          transactionId,
          requestedAt: new Date(),
        },
      });

      this.logger.log(
        `Withdrawal requested: ${amount} XLM from ${userId} to ${destination}`,
      );

      return { success: true, transactionId };
    } catch (error) {
      this.logger.error(`Withdrawal request failed: ${error.message}`, error.stack);

      // Emit audit event for error
      this.eventEmitter.emit('wallet.withdrawal_requested', {
        actionType: 'WITHDRAWAL',
        userId,
        ipAddress,
        userAgent,
        status: 'FAILURE',
        errorMessage: error.message,
        resourceType: 'wallet',
        resourceId: userId,
        metadata: {
          amount,
          destination,
          reason: 'system_error',
        },
      });

      throw error;
    }
  }

  /**
   * Complete a withdrawal transaction
   * Emits audit event upon completion for compliance tracking
   */
  async completeWithdrawal(
    userId: string,
    transactionHash: string,
    amount: number,
    destination: string,
    ipAddress: string,
    userAgent?: string,
  ): Promise<{ success: boolean }> {
    try {
      if (!transactionHash) {
        throw new BadRequestException('Transaction hash is required');
      }

      const wallet = await this.findByUserId(userId);
      if (!wallet) {
        throw new BadRequestException('Wallet not found for user');
      }

      // Emit audit event for withdrawal completion
      this.eventEmitter.emit('wallet.withdrawal_completed', {
        actionType: 'WITHDRAWAL',
        userId,
        ipAddress,
        userAgent,
        status: 'SUCCESS',
        resourceType: 'wallet',
        resourceId: wallet.id,
        metadata: {
          amount,
          destination,
          transactionHash,
          currency: 'XLM',
          completedAt: new Date(),
        },
      });

      this.logger.log(
        `Withdrawal completed: ${amount} XLM, transaction hash: ${transactionHash}`,
      );

      return { success: true };
    } catch (error) {
      this.logger.error(`Withdrawal completion failed: ${error.message}`, error.stack);

      // Emit audit event for error
      this.eventEmitter.emit('wallet.withdrawal_completed', {
        actionType: 'WITHDRAWAL',
        userId,
        ipAddress,
        userAgent,
        status: 'FAILURE',
        errorMessage: error.message,
        resourceType: 'wallet',
        resourceId: userId,
        metadata: {
          amount,
          destination,
          transactionHash,
        },
      });

      throw error;
    }
  }

  /**
   * Request a deposit to user's wallet
   * Emits audit events for compliance tracking
   */
  async requestDeposit(
    userId: string,
    amount: number,
    ipAddress: string,
    userAgent?: string,
  ): Promise<{ success: boolean; transactionId: string }> {
    try {
      if (amount <= 0) {
        throw new BadRequestException('Deposit amount must be positive');
      }

      const wallet = await this.findByUserId(userId);
      if (!wallet) {
        throw new BadRequestException('Wallet not found for user');
      }

      const balanceBefore = await this.getWalletBalance(userId);
      const transactionId = `deposit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Emit audit event for deposit
      this.eventEmitter.emit('wallet.deposit_requested', {
        actionType: 'DEPOSIT',
        userId,
        ipAddress,
        userAgent,
        status: 'SUCCESS',
        resourceType: 'wallet',
        resourceId: wallet.id,
        statePreviousValue: { balance: parseFloat(balanceBefore.balance) },
        stateNewValue: { balance: parseFloat(balanceBefore.balance) + amount },
        metadata: {
          amount,
          currency: 'XLM',
          transactionId,
          requestedAt: new Date(),
        },
      });

      this.logger.log(`Deposit requested: ${amount} XLM to wallet ${userId}`);

      return { success: true, transactionId };
    } catch (error) {
      this.logger.error(`Deposit request failed: ${error.message}`, error.stack);

      this.eventEmitter.emit('wallet.deposit_requested', {
        actionType: 'DEPOSIT',
        userId,
        ipAddress,
        userAgent,
        status: 'FAILURE',
        errorMessage: error.message,
        resourceType: 'wallet',
        resourceId: userId,
        metadata: {
          amount,
          reason: 'system_error',
        },
      });

      throw error;
    }
  }

  /**
   * Validate Stellar address format
   */
  private isValidStellarAddress(address: string): boolean {
    // Stellar public key starts with 'G' and is 56 characters long
    return /^G[A-Z2-7]{55}$/.test(address);
  }
}

