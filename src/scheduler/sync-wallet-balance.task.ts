import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { WalletService } from '../wallet/wallet.service';

@Injectable()
export class SyncWalletBalanceTask {
  private readonly logger = new Logger(SyncWalletBalanceTask.name);

  constructor(private readonly walletService: WalletService) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleCron() {
    this.logger.log('Starting wallet balance sync job...');
    try {
      await this.walletService.syncAllWalletBalances();
      this.logger.log('Wallet balance sync completed.');
    } catch (error) {
      this.logger.error('Wallet balance sync failed', error.stack || error.message);
    }
  }
}
