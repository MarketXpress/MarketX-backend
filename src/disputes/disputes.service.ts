import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Dispute, DisputeStatus } from './dispute.entity';
import { Evidence } from './evidence.entity';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { SubmitEvidenceDto } from './dto/submit-evidence.dto';
import { EscalateDisputeDto } from './dto/escalate-dispute.dto';
import { UpdateDisputeDto } from './dto/update-dispute.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';
import { DisputeStateMachine } from './state-machine/dispute.state-machine';
import { EscrowService } from '../escrowes/escrow.service';
import { EscrowEntity } from '../escrowes/entities/escrow.entity';

@Injectable()
export class DisputesService {
  private readonly logger = new Logger(DisputesService.name);

  constructor(
    @InjectRepository(Dispute)
    private readonly disputeRepo: Repository<Dispute>,
    @InjectRepository(Evidence)
    private readonly evidenceRepo: Repository<Evidence>,
    @InjectRepository(EscrowEntity)
    private readonly escrowRepo: Repository<EscrowEntity>,
    private readonly escrowService: EscrowService,
  ) {}

  async createDispute(dto: CreateDisputeDto): Promise<Dispute> {
    const dispute = this.disputeRepo.create({
      ...dto,
      status: DisputeStatus.OPEN,
      description: dto.description,
      imageUrls: dto.imageUrls,
    });

    const savedDispute = await this.disputeRepo.save(dispute);

    // Freeze the escrow and set dispute flag if escrowId is provided
    if (dto.escrowId) {
      try {
        await this.escrowService.freezeEscrow(dto.escrowId);

        // Set the dispute flag to prevent auto-release
        await this.escrowRepo.update(
          { id: dto.escrowId },
          { disputeFlag: true },
        );
  Inject,
  forwardRef,

        this.logger.log(
          `Escrow ${dto.escrowId} frozen and disputeFlag set for dispute ${savedDispute.id}`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to freeze escrow ${dto.escrowId}: ${error.message}`,
        );
        throw new BadRequestException(
          `Failed to freeze escrow: ${error.message}`,
        );
      }
    }
import { DisputeAiWorker } from './dispute-ai.worker';

    return savedDispute;
  }

  async getDisputeById(id: string): Promise<Dispute> {
    const dispute = await this.disputeRepo.findOne({
      where: { id },
      relations: ['evidences'],
    });
    if (!dispute) throw new NotFoundException('Dispute not found');
    return dispute;
  }

    private readonly disputeAiWorker: DisputeAiWorker,
  async listDisputes(filter: Partial<Dispute> = {}): Promise<Dispute[]> {
    return this.disputeRepo.find({
      where: filter,
      relations: ['evidences'],
      order: { createdAt: 'DESC' },
    });
  }

  async submitEvidence(dto: SubmitEvidenceDto): Promise<Evidence> {
    const dispute = await this.getDisputeById(dto.disputeId);
    if (
      dispute.status === DisputeStatus.RESOLVED ||
      dispute.status === DisputeStatus.REJECTED
    ) {
      throw new BadRequestException(
        'Cannot submit evidence to a closed dispute',
      );
    }
    const evidence = this.evidenceRepo.create(dto);
    return this.evidenceRepo.save(evidence);
  }

  async escalateDispute(
    dto: EscalateDisputeDto,
    userId: string,
  ): Promise<Dispute> {
    const dispute = await this.getDisputeById(dto.disputeId);
    if (dispute.complainantId !== userId) {
      throw new ForbiddenException(
        'Only the complainant can escalate the dispute',
      );
    }
    if (
      !DisputeStateMachine.canTransition(
        dispute.status,
        DisputeStatus.ESCALATED,
    // Trigger AI worker (TOS string should be passed here)
    try {
      await this.disputeAiWorker.processDispute(savedDispute.id, 'PLATFORM_TOS_STRING');
    } catch (err) {
      this.logger.error(`AI worker failed for dispute ${savedDispute.id}: ${err.message}`);
    }
      )
    ) {
      throw new BadRequestException(
        'Cannot escalate dispute from current status',
      );
    }
    dispute.status = DisputeStatus.ESCALATED;
    return this.disputeRepo.save(dispute);
  }

  async adminUpdateDispute(dto: UpdateDisputeDto): Promise<Dispute> {
    const dispute = await this.getDisputeById(dto.disputeId);
    if (
      dto.status &&
      !DisputeStateMachine.canTransition(dispute.status, dto.status)
    const updated = await this.disputeRepo.save(dispute);
    // Re-run AI worker after admin update (optional, can be removed if not needed)
    try {
      await this.disputeAiWorker.processDispute(updated.id, 'PLATFORM_TOS_STRING');
    } catch (err) {
      this.logger.error(`AI worker failed for dispute ${updated.id}: ${err.message}`);
    }
    return updated;
    ) {
      throw new BadRequestException('Invalid status transition');
    }
    if (dto.status) dispute.status = dto.status;
    if (dto.resolutionNote)
      (dispute as any).resolutionNote = dto.resolutionNote;
    return this.disputeRepo.save(dispute);
  }

  async autoResolveDisputes(): Promise<number> {
    const openDisputes = await this.disputeRepo.find({
      where: { status: DisputeStatus.OPEN },
      relations: ['evidences'],
    });
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

  /**
   * Admin resolve dispute - distributes funds according to admin decision
   */
  async adminResolveDispute(
    dto: ResolveDisputeDto,
    disputeId: string,
  ): Promise<Dispute> {
    const dispute = await this.getDisputeById(disputeId);

    if (
      !DisputeStateMachine.canTransition(dispute.status, DisputeStatus.RESOLVED)
    ) {
      throw new BadRequestException(
        'Cannot resolve dispute from current status',
      );
    }

    // If escrow is associated, release funds according to distribution
    if (dispute.escrowId) {
      try {
        // Calculate distribution based on refund amount
        const totalAmount = parseFloat(
          (
            await this.escrowService['findEscrowOrFail'](dispute.escrowId)
          ).amount.toString(),
        );
        const refundAmount = dto.refundAmount || 0;

        await this.escrowService.adminReleaseFunds(dispute.escrowId, {
          toSeller: totalAmount - refundAmount,
          toBuyer: refundAmount,
        });

        this.logger.log(
          `Funds distributed for dispute ${disputeId}: $${refundAmount} to buyer, $${totalAmount - refundAmount} to seller`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to distribute funds for dispute ${disputeId}: ${error.message}`,
        );
        throw new BadRequestException(
          `Failed to distribute funds: ${error.message}`,
        );
      }
    }

    dispute.status = DisputeStatus.RESOLVED;
    (dispute as any).resolutionNote = dto.adminDecision;

    return this.disputeRepo.save(dispute);
  }
}
