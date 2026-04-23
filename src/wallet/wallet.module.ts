import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import { Wallet } from './entities/wallet.entity';
import { WalletKeyAudit } from './entities/wallet-key-audit.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Wallet, WalletKeyAudit])],
  controllers: [WalletController],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
