import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Dispute, DisputeStatus } from './entities/dispute.entity';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { EscrowService } from '../escrow/escrow.service';

@Injectable()
export class DisputesService {
  constructor(
    @InjectRepository(Dispute)
    private disputeRepository: Repository<Dispute>,
    private escrowService: EscrowService,
  ) {}

  async create(orderId: number, buyerId: number, createDisputeDto: CreateDisputeDto): Promise<Dispute> {
    const dispute = this.disputeRepository.create({
      orderId,
      buyerId,
      ...createDisputeDto,
    });
    return this.disputeRepository.save(dispute);
  }

  async findAll(): Promise<Dispute[]> {
    return this.disputeRepository.find();
  }

  async resolve(id: number, adminDecision: string, refundAmount?: number): Promise<Dispute> {
    const dispute = await this.disputeRepository.findOne({ where: { id } });
    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    dispute.status = DisputeStatus.RESOLVED;
    dispute.adminDecision = adminDecision;
    if (refundAmount !== undefined) {
      dispute.refundAmount = refundAmount;
      // Integrate with escrow
      await this.escrowService.allocateFunds(dispute.orderId, refundAmount);
    }

    return this.disputeRepository.save(dispute);
  }
}