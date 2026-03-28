import { Module } from '@nestjs/common';
import { SyncWalletBalanceTask } from './sync-wallet-balance.task';
import { WalletModule } from 'src/wallet/wallet.module';
import { ExpireListingsTask } from './expire-listings.task';
import { PiiPurgeTask } from './pii-purge.task';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Listing } from '../listing/entities/listing.entity';
import { Users } from '../users/users.entity';

@Module({
  imports: [WalletModule, TypeOrmModule.forFeature([Listing, Users])],
  providers: [SyncWalletBalanceTask, ExpireListingsTask, PiiPurgeTask],
  exports: [SyncWalletBalanceTask, ExpireListingsTask, PiiPurgeTask],
})
export class SchedulerModule {}
