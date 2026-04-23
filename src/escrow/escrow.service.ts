import { Injectable } from '@nestjs/common';

@Injectable()
export class EscrowService {
  // Placeholder for escrow fund allocation logic
  async allocateFunds(orderId: number, amount: number): Promise<void> {
    // Implement escrow fund allocation based on dispute resolution
    // For example, release funds to buyer or seller
    console.log(`Allocating ${amount} from escrow for order ${orderId}`);
    // Actual implementation would interact with payment gateway or escrow system
  }

  async assignTransactionHash(escrowId: string, txHash?: string | null) {
  const escrow = await this.escrowRepo.findOneBy({ id: escrowId });
  if (!escrow) throw new Error('Escrow not found');

  // ✅ allow null assignment
  escrow.transactionHash = txHash ?? null;
  await this.escrowRepo.save(escrow);
  return escrow;
}

}

