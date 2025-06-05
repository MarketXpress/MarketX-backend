import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { Wallet } from './entities/wallet.entity';
import { WalletKeyAudit } from './entities/wallet-key-audit.entity';
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
}
