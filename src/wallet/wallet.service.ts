import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { Wallet } from './entities/wallet.entity';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(Wallet)
    private walletRepository: Repository<Wallet>,
    private configService: ConfigService,
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
}
