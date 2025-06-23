import { Module } from '@nestjs/common';
import { SyncWalletBalanceTask } from './sync-wallet-balance.task';
import { WalletModule } from 'src/wallet/wallet.module';

@Module({
  imports: [WalletModule],
  providers: [SyncWalletBalanceTask],
  exports: [SyncWalletBalanceTask],
})
export class SchedulerModule {}
