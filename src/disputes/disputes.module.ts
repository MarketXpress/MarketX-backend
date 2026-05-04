import { Module } from '@nestjs/common';
import { DisputeAiWorker } from './dispute-ai.worker';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Dispute } from './dispute.entity';
import { Evidence } from './evidence.entity';
import { DisputesService } from './disputes.service';
import { DisputesController } from './disputes.controller';
import { AdminDisputesController } from './admin-disputes.controller';
import { EscrowModule } from '../escrowes/escrow.module';
import { EscrowEntity } from '../escrowes/entities/escrow.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Dispute, Evidence, EscrowEntity]),
    EscrowModule,
  ],
  providers: [DisputesService, DisputeAiWorker],
  controllers: [DisputesController, AdminDisputesController],
  exports: [DisputesService],
})
export class DisputesModule {}
