import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Refund, RefundStatus, RefundType } from './entities/refund.entity';
import { RequestRefundDto } from './dto/request-refund.dto';
import { ApproveRefundDto } from './dto/approve-refund.dto';
import { OrdersService } from '../orders/orders.service';
import { EscrowService } from '../escrowes/escrow.service';
import {
  OrderStatus,
  UpdateOrderStatusDto,
} from '../orders/dto/create-order.dto';

const REFUND_WINDOW_DAYS = 30;

@Injectable()
export class RefundsService {
  constructor(
    @InjectRepository(Refund)
    private readonly refundRepo: Repository<Refund>,
    private readonly ordersService: OrdersService,
    private readonly escrowService: EscrowService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ─── Buyer: Request a Refund ────────────────────────────────────────────────

  async requestRefund(
    orderId: string,
    buyerId: string,
    dto: RequestRefundDto,
  ): Promise<Refund> {
    const order = await this.ordersService.findOne(orderId);

    // Ownership check
    if (order.buyerId !== buyerId) {
      throw new ForbiddenException('You are not the buyer of this order.');
    }

    // Status check — only delivered orders are refundable
    if (order.status !== OrderStatus.DELIVERED) {
      throw new BadRequestException('Only delivered orders can be refunded.');
    }

    // Time-window check
    const deliveredAt: Date | undefined = order.deliveredAt;
    if (!deliveredAt) {
      throw new BadRequestException('Order has no delivery date recorded.');
    }
    const diffDays =
      (Date.now() - deliveredAt.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays > REFUND_WINDOW_DAYS) {
      throw new BadRequestException(
        `Refund window of ${REFUND_WINDOW_DAYS} days has passed.`,
      );
    }

    // Duplicate check
    const existing = await this.refundRepo.findOne({
      where: { orderId, status: RefundStatus.PENDING },
    });
    if (existing) {
      throw new BadRequestException(
        'A pending refund request already exists for this order.',
      );
    }

    // Amount validation
    const originalAmount = Number(order.totalAmount);
    let requestedAmount: number;

    if (dto.type === RefundType.FULL) {
      requestedAmount = originalAmount;
    } else {
      if (!dto.requestedAmount) {
        throw new BadRequestException(
          'requestedAmount is required for partial refunds.',
        );
      }
      requestedAmount = Number(dto.requestedAmount);
      if (requestedAmount > originalAmount) {
        throw new BadRequestException(
          `Requested amount (${requestedAmount}) exceeds original payment (${originalAmount}).`,
        );
      }
    }

    const refund = this.refundRepo.create({
      orderId,
      buyerId,
      type: dto.type,
      reason: dto.reason,
      description: dto.description,
      requestedAmount,
      status: RefundStatus.PENDING,
    });

    const saved = await this.refundRepo.save(refund);

    this.eventEmitter.emit('refund.requested', {
      refundId: saved.id,
      orderId,
      buyerId,
      amount: requestedAmount,
    });

    return saved;
  }

  // ─── Admin: Approve a Refund ────────────────────────────────────────────────

  async approveRefund(
    refundId: string,
    adminId: string,
    dto: ApproveRefundDto,
  ): Promise<Refund> {
    const refund = await this.findOne(refundId);

    if (refund.status !== RefundStatus.PENDING) {
      throw new BadRequestException(
        `Cannot approve a refund with status: ${refund.status}`,
      );
    }

    // Verify approved amount does not exceed original payment
    const order = await this.ordersService.findOne(refund.orderId);
    const originalAmount = Number(order.totalAmount);
    const approvedAmount = Number(dto.approvedAmount);

    if (approvedAmount > originalAmount) {
      throw new BadRequestException(
        `Approved amount (${approvedAmount}) exceeds original payment (${originalAmount}).`,
      );
    }
    if (approvedAmount > refund.requestedAmount) {
      throw new BadRequestException(
        `Approved amount cannot exceed the requested amount (${refund.requestedAmount}).`,
      );
    }

    refund.status = RefundStatus.APPROVED;
    refund.approvedAmount = approvedAmount;
    refund.reviewedById = adminId;
    refund.adminNotes = dto.adminNotes ?? '';

    await this.refundRepo.save(refund);

    // Trigger Stellar refund transaction
    return this.processStellarRefund(refund, order);
  }

  // ─── Admin: Reject a Refund ─────────────────────────────────────────────────

  async rejectRefund(
    refundId: string,
    adminId: string,
    adminNotes?: string,
  ): Promise<Refund> {
    const refund = await this.findOne(refundId);

    if (refund.status !== RefundStatus.PENDING) {
      throw new BadRequestException(
        `Cannot reject a refund with status: ${refund.status}`,
      );
    }

    refund.status = RefundStatus.REJECTED;
    refund.reviewedById = adminId;
    refund.adminNotes = adminNotes ?? '';

    const saved = await this.refundRepo.save(refund);

    this.eventEmitter.emit('refund.rejected', {
      refundId: saved.id,
      orderId: saved.orderId,
      buyerId: saved.buyerId,
    });

    return saved;
  }

  // ─── Stellar Refund Processing ──────────────────────────────────────────────

  private async processStellarRefund(
    refund: Refund,
    order: any,
  ): Promise<Refund> {
    try {
      const escrowByOrder = await this.escrowService.getEscrowByOrderId(
        order.id,
      );

      const escrowResponse = await this.escrowService.refundBuyer({
        escrowId: escrowByOrder.id,
        reason: `REFUND:${refund.id}`,
      });

      refund.status = RefundStatus.PROCESSED;
      refund.stellarTransactionHash =
        escrowResponse.refundTransactionHash ?? '';
      refund.processedAt = new Date();

      // Update order status
      await this.ordersService.updateStatus(refund.orderId, {
        status: OrderStatus.CANCELLED,
      } as UpdateOrderStatusDto);

      // Restore inventory if full refund
      if (refund.type === RefundType.FULL) {
        this.eventEmitter.emit('refund.inventory.restore', {
          orderId: refund.orderId,
        });
      }

      const saved = await this.refundRepo.save(refund);

      this.eventEmitter.emit('refund.processed', {
        refundId: saved.id,
        orderId: saved.orderId,
        buyerId: saved.buyerId,
        amount: saved.approvedAmount,
        txHash: refund.stellarTransactionHash,
      });

      return saved;
    } catch (error) {
      refund.status = RefundStatus.FAILED;
      refund.metadata = { error: error.message };
      await this.refundRepo.save(refund);

      this.eventEmitter.emit('refund.failed', {
        refundId: refund.id,
        buyerId: refund.buyerId,
        error: error.message,
      });

      throw new BadRequestException(
        `Stellar refund transaction failed: ${error.message}`,
      );
    }
  }

  // ─── Queries ────────────────────────────────────────────────────────────────

  async findAll(filters?: { buyerId?: string; status?: RefundStatus }) {
    const where: any = {};
    if (filters?.buyerId) where.buyerId = filters.buyerId;
    if (filters?.status) where.status = filters.status;
    return this.refundRepo.find({ where, order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<Refund> {
    const refund = await this.refundRepo.findOne({ where: { id } });
    if (!refund) throw new NotFoundException(`Refund ${id} not found.`);
    return refund;
  }

  async findByOrder(orderId: string): Promise<Refund[]> {
    return this.refundRepo.find({
      where: { orderId },
      order: { createdAt: 'DESC' },
    });
  }
}
