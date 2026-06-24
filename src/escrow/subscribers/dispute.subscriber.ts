import {
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
} from 'typeorm';
import { Dispute } from '../../dispute/disputes.entity';
import { EscrowService } from '../escrow.service';

@EventSubscriber()
export class DisputeSubscriber implements EntitySubscriberInterface<Dispute> {
  constructor(private readonly escrowService: EscrowService) {}

  listenTo() {
    return Dispute;
  }

  async afterInsert(event: InsertEvent<Dispute>) {
    const dispute = event.entity;
    if (dispute && dispute.orderId) {
      await this.escrowService.handleDisputeRaised(dispute.orderId);
    }
  }
}
