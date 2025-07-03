import { Module } from '@nestjs/common';
import { SyncWalletBalanceTask } from './sync-wallet-balance.task';
import { WalletModule } from 'src/wallet/wallet.module';
import { ExpireListingsTask } from './expire-listings.task';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Listing } from '../listing/entities/listing.entity';

@Module({
  imports: [WalletModule, TypeOrmModule.forFeature([Listing])],
  providers: [SyncWalletBalanceTask, ExpireListingsTask],
  exports: [SyncWalletBalanceTask, ExpireListingsTask],
})
export class SchedulerModule {}
