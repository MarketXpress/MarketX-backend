import { Module } from '@nestjs/common';
import { SyncWalletBalanceTask } from './sync-wallet-balance.task';

@Module({
  providers: [SyncWalletBalanceTask],
})
export class SchedulerModule {}
