import { Module } from '@nestjs/common';
import { SyncWalletBalanceTask } from './sync-wallet-balance.task';
import { WalletModule } from 'src/wallet/wallet.module';
import { ExpireListingsTask } from './expire-listings.task';
import { PiiPurgeTask } from './pii-purge.task';
import { EscrowAutoReleaseTask } from './escrow-auto-release.task';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Listing } from '../listing/entities/listing.entity';
import { Users } from '../users/users.entity';
import { EscrowEntity } from '../escrowes/entities/escrow.entity';
import { Order } from '../entities/order.entity';
import { Dispute } from '../disputes/dispute.entity';
import { EscrowModule } from '../escrowes/escrow.module';
import { EscrowService } from '../escrowes/escrow.service';

@Module({
  imports: [
    WalletModule,
    EscrowModule,
    TypeOrmModule.forFeature([Listing, Users, EscrowEntity, Order, Dispute]),
  ],
  providers: [
    SyncWalletBalanceTask,
    ExpireListingsTask,
    PiiPurgeTask,
    EscrowAutoReleaseTask,
  ],
  exports: [
    SyncWalletBalanceTask,
    ExpireListingsTask,
    PiiPurgeTask,
    EscrowAutoReleaseTask,
  ],
})
export class SchedulerModule {}
