import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Dispute, DisputeStatus } from './dispute.entity';
import { Evidence } from './evidence.entity';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { SubmitEvidenceDto } from './dto/submit-evidence.dto';
import { EscalateDisputeDto } from './dto/escalate-dispute.dto';
import { UpdateDisputeDto } from './dto/update-dispute.dto';
import { DisputeStateMachine } from './state-machine/dispute.state-machine';

@Injectable()
export class DisputesService {
  private readonly logger = new Logger(DisputesService.name);

  constructor(
    @InjectRepository(Dispute)
    private readonly disputeRepo: Repository<Dispute>,
    @InjectRepository(Evidence)
    private readonly evidenceRepo: Repository<Evidence>,
  ) {}

  async createDispute(dto: CreateDisputeDto): Promise<Dispute> {
    const dispute = this.disputeRepo.create({ ...dto, status: DisputeStatus.OPEN });
    return this.disputeRepo.save(dispute);
  }

  async getDisputeById(id: string): Promise<Dispute> {
    const dispute = await this.disputeRepo.findOne({ where: { id }, relations: ['evidences'] });
    if (!dispute) throw new NotFoundException('Dispute not found');
    return dispute;
  }

  async listDisputes(filter: Partial<Dispute> = {}): Promise<Dispute[]> {
    return this.disputeRepo.find({ where: filter, relations: ['evidences'], order: { createdAt: 'DESC' } });
  }

  async submitEvidence(dto: SubmitEvidenceDto): Promise<Evidence> {
    const dispute = await this.getDisputeById(dto.disputeId);
    if (dispute.status === DisputeStatus.RESOLVED || dispute.status === DisputeStatus.REJECTED) {
      throw new BadRequestException('Cannot submit evidence to a closed dispute');
    }
    const evidence = this.evidenceRepo.create(dto);
    return this.evidenceRepo.save(evidence);
  }

  async escalateDispute(dto: EscalateDisputeDto, userId: string): Promise<Dispute> {
    const dispute = await this.getDisputeById(dto.disputeId);
    if (dispute.complainantId !== userId) {
      throw new ForbiddenException('Only the complainant can escalate the dispute');
    }
    if (!DisputeStateMachine.canTransition(dispute.status, DisputeStatus.ESCALATED)) {
      throw new BadRequestException('Cannot escalate dispute from current status');
    }
    dispute.status = DisputeStatus.ESCALATED;
    return this.disputeRepo.save(dispute);
  }

  async adminUpdateDispute(dto: UpdateDisputeDto): Promise<Dispute> {
    const dispute = await this.getDisputeById(dto.disputeId);
    if (dto.status && !DisputeStateMachine.canTransition(dispute.status, dto.status)) {
      throw new BadRequestException('Invalid status transition');
    }
    if (dto.status) dispute.status = dto.status;
    if (dto.resolutionNote) (dispute as any).resolutionNote = dto.resolutionNote;
    return this.disputeRepo.save(dispute);
  }

  async autoResolveDisputes(): Promise<number> {
    const openDisputes = await this.disputeRepo.find({ where: { status: DisputeStatus.OPEN }, relations: ['evidences'] });
    let resolvedCount = 0;
    for (const dispute of openDisputes) {
      if (DisputeStateMachine.shouldAutoResolve(dispute, new Date())) {
        dispute.status = DisputeStatus.AUTO_RESOLVED;
        await this.disputeRepo.save(dispute);
        resolvedCount++;
      }
    }
    return resolvedCount;
  }

  // Evidence file upload helper (stub)
  async uploadEvidenceFile(file: any): Promise<string> {
    // Implement actual file storage (e.g., S3, local, etc.)
    // For now, just return the filename
    return file.filename;
  }

  // Notification stub
  async notifyParties(dispute: Dispute, message: string) {
    // Implement email or in-app notification
    this.logger.log(`Notify parties of dispute ${dispute.id}: ${message}`);
  }
} 
