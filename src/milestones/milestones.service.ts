import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Milestone } from './entities/milestone.entity';
import { Order } from '../orders/entities/order.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import {
  TransactionStatus,
  TransactionType,
} from '../transactions/entities/transaction.entity';
import {
  MilestoneStatus,
  MilestoneType,
  MilestoneTrigger,
} from './enums/milestone.enums';
import { TransactionsService } from '../transactions/transactions.service';

export interface CreateMilestoneDto {
  orderId: string;
  title: string;
  description: string;
  amount: number;
  percentage: number;
  type: MilestoneType;
  trigger: MilestoneTrigger;
  autoRelease: boolean;
  releaseConditions?: string[];
  requiredDocuments?: string[];
  sortOrder: number;
}

export interface ReleaseMilestoneDto {
  milestoneId: string;
  approvedBy: string;
  notes?: string;
  documents?: Array<{
    id: string;
    name: string;
    url: string;
  }>;
}

export interface UpdateMilestoneStatusDto {
  milestoneId: string;
  status: MilestoneStatus;
  adminNotes?: string;
  rejectionReason?: string;
  disputeDetails?: {
    reason: string;
    description: string;
    evidence: string[];
  };
}

@Injectable()
export class MilestonesService {
  private readonly logger = new Logger(MilestonesService.name);

  constructor(
    @InjectRepository(Milestone)
    private readonly milestoneRepo: Repository<Milestone>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    private readonly transactionsService: TransactionsService,
  ) {}

  /**
   * Create milestones for an order
   */
  async createMilestones(
    orderId: string,
    milestones: CreateMilestoneDto[],
  ): Promise<Milestone[]> {
    this.logger.log(
      `Creating ${milestones.length} milestones for order ${orderId}`,
    );

    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Validate total milestone amounts don't exceed order total
    const totalMilestoneAmount = milestones.reduce(
      (sum, m) => sum + m.amount,
      0,
    );
    if (totalMilestoneAmount > order.totalAmount) {
      throw new BadRequestException(
        'Total milestone amounts cannot exceed order total',
      );
    }

    const createdMilestones = milestones.map((milestoneData, index) => {
      const milestone = this.milestoneRepo.create({
        ...milestoneData,
        orderId,
        status: MilestoneStatus.PENDING,
        sortOrder: milestoneData.sortOrder || index,
      });
      return milestone;
    });

    return this.milestoneRepo.save(createdMilestones);
  }

  /**
   * Get milestones for an order
   */
  async getOrderMilestones(orderId: string): Promise<Milestone[]> {
    return this.milestoneRepo.find({
      where: { orderId },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
      relations: ['order'],
    });
  }

  /**
   * Get milestone by ID
   */
  async getMilestoneById(milestoneId: string): Promise<Milestone> {
    const milestone = await this.milestoneRepo.findOne({
      where: { id: milestoneId },
      relations: ['order'],
    });

    if (!milestone) {
      throw new NotFoundException('Milestone not found');
    }

    return milestone;
  }

  /**
   * Release funds for a milestone
   */
  async releaseMilestone(
    milestoneId: string,
    releaseData: ReleaseMilestoneDto,
  ): Promise<Milestone> {
    this.logger.log(`Releasing milestone ${milestoneId}`);

    const milestone = await this.getMilestoneById(milestoneId);

    if (
      milestone.status !== MilestoneStatus.PENDING &&
      milestone.status !== MilestoneStatus.APPROVED
    ) {
      throw new BadRequestException(
        'Milestone cannot be released in current status',
      );
    }

    // Update milestone status
    milestone.status = MilestoneStatus.RELEASED;
    milestone.releasedAt = new Date();
    milestone.adminNotes = releaseData.notes;

    // Add uploaded documents if provided
    if (releaseData.documents) {
      milestone.uploadedDocuments = releaseData.documents.map((doc) => ({
        ...doc,
        uploadedAt: new Date(),
      }));
    }

    const updatedMilestone = await this.milestoneRepo.save(milestone);

    // Create transaction for milestone release
    await this.createMilestoneTransaction(milestone);

    // Update order released amount
    await this.updateOrderReleasedAmount(milestone.orderId, milestone.amount);

    return updatedMilestone;
  }

  /**
   * Approve a milestone (prepare for release)
   */
  async approveMilestone(
    milestoneId: string,
    approvedBy: string,
    notes?: string,
  ): Promise<Milestone> {
    this.logger.log(`Approving milestone ${milestoneId}`);

    const milestone = await this.getMilestoneById(milestoneId);

    if (milestone.status !== MilestoneStatus.PENDING) {
      throw new BadRequestException(
        'Milestone cannot be approved in current status',
      );
    }

    milestone.status = MilestoneStatus.APPROVED;
    milestone.adminNotes = notes;

    return this.milestoneRepo.save(milestone);
  }

  /**
   * Reject a milestone
   */
  async rejectMilestone(
    milestoneId: string,
    rejectionData: UpdateMilestoneStatusDto,
  ): Promise<Milestone> {
    this.logger.log(`Rejecting milestone ${milestoneId}`);

    const milestone = await this.getMilestoneById(milestoneId);

    if (
      milestone.status !== MilestoneStatus.PENDING &&
      milestone.status !== MilestoneStatus.APPROVED
    ) {
      throw new BadRequestException(
        'Milestone cannot be rejected in current status',
      );
    }

    milestone.status = MilestoneStatus.REJECTED;
    milestone.rejectionReason = rejectionData.rejectionReason;
    milestone.adminNotes = rejectionData.adminNotes;

    return this.milestoneRepo.save(milestone);
  }

  /**
   * Update milestone status
   */
  async updateMilestoneStatus(
    milestoneId: string,
    updateData: UpdateMilestoneStatusDto,
  ): Promise<Milestone> {
    const milestone = await this.getMilestoneById(milestoneId);

    milestone.status = updateData.status;

    if (updateData.adminNotes) {
      milestone.adminNotes = updateData.adminNotes;
    }

    if (updateData.rejectionReason) {
      milestone.rejectionReason = updateData.rejectionReason;
    }

    if (updateData.disputeDetails) {
      milestone.disputeDetails = {
        ...updateData.disputeDetails,
        raisedBy: updateData.disputeDetails.raisedBy || 'system',
        raisedAt: new Date(),
      };
      milestone.status = MilestoneStatus.DISPUTED;
    }

    return this.milestoneRepo.save(milestone);
  }

  /**
   * Process automatic milestone releases
   */
  async processAutomaticReleases(): Promise<void> {
    this.logger.log('Processing automatic milestone releases');

    const pendingMilestones = await this.milestoneRepo.find({
      where: {
        status: MilestoneStatus.PENDING,
        autoRelease: true,
        releaseAt: LessThan(new Date()),
      },
      relations: ['order'],
    });

    for (const milestone of pendingMilestones) {
      try {
        await this.releaseMilestone(milestone.id, {
          milestoneId: milestone.id,
          approvedBy: 'system',
          notes: 'Automatic release based on trigger conditions',
        });
        this.logger.log(
          `Auto-released milestone ${milestone.id} for order ${milestone.orderId}`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to auto-release milestone ${milestone.id}: ${error.message}`,
        );
      }
    }

    this.logger.log(
      `Processed ${pendingMilestones.length} automatic milestone releases`,
    );
  }

  /**
   * Get milestone statistics
   */
  async getMilestoneStatistics(orderId: string): Promise<{
    totalMilestones: number;
    pendingMilestones: number;
    approvedMilestones: number;
    releasedMilestones: number;
    rejectedMilestones: number;
    totalReleasedAmount: number;
    totalPendingAmount: number;
  }> {
    const milestones = await this.getOrderMilestones(orderId);

    const stats = {
      totalMilestones: milestones.length,
      pendingMilestones: milestones.filter(
        (m) => m.status === MilestoneStatus.PENDING,
      ).length,
      approvedMilestones: milestones.filter(
        (m) => m.status === MilestoneStatus.APPROVED,
      ).length,
      releasedMilestones: milestones.filter(
        (m) => m.status === MilestoneStatus.RELEASED,
      ).length,
      rejectedMilestones: milestones.filter(
        (m) => m.status === MilestoneStatus.REJECTED,
      ).length,
      totalReleasedAmount: milestones
        .filter((m) => m.status === MilestoneStatus.RELEASED)
        .reduce((sum, m) => sum + Number(m.amount), 0),
      totalPendingAmount: milestones
        .filter((m) => m.status === MilestoneStatus.PENDING)
        .reduce((sum, m) => sum + Number(m.amount), 0),
    };

    return stats;
  }

  /**
   * Create transaction for milestone release
   */
  private async createMilestoneTransaction(
    milestone: Milestone,
  ): Promise<Transaction> {
    const order = milestone.order;

    const transactionData = {
      amount: Number(milestone.amount),
      description: `Milestone release: ${milestone.title}`,
      senderId: parseInt(order.buyerId), // Escrow releases from buyer to seller
      receiverId: parseInt(order.sellerId),
      type: TransactionType.TRANSFER,
      status: TransactionStatus.PENDING,
      metadata: {
        milestoneId: milestone.id,
        orderId: order.id,
        milestoneTitle: milestone.title,
        releaseType: 'milestone',
      },
    };

    return this.transactionsService.createTransaction(transactionData);
  }

  /**
   * Update order released amount
   */
  private async updateOrderReleasedAmount(
    orderId: string,
    amount: number,
  ): Promise<void> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (order) {
      order.releasedAmount = Number(order.releasedAmount) + amount;
      order.remainingAmount =
        Number(order.totalAmount) - Number(order.releasedAmount);
      await this.orderRepo.save(order);
    }
  }
}
