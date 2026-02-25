/* eslint-disable prettier/prettier */
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ReturnRequest,
  ReturnStatus,
  RefundType,
} from './entities/return-request.entity';
import { RefundHistory } from './entities/refund-history.entity';
import { Order } from '../orders/entities/order.entity';
import {
  CreateReturnRequestDto,
  ReviewReturnRequestDto,
  ProcessRefundDto,
  QueryReturnRequestsDto,
} from './dto/refund.dto';
import { InventoryService } from '../inventory/inventory.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

const DEFAULT_RETURN_WINDOW_DAYS = 30;

@Injectable()
export class RefundsService {
  private readonly logger = new Logger(RefundsService.name);

  constructor(
    @InjectRepository(ReturnRequest)
    private readonly returnRequestRepository: Repository<ReturnRequest>,
    @InjectRepository(RefundHistory)
    private readonly refundHistoryRepository: Repository<RefundHistory>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly inventoryService: InventoryService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ─────────────────────────────────────────────────────────────
  // CREATE RETURN REQUEST (Merged + Improved Validation)
  // ─────────────────────────────────────────────────────────────

  async createReturnRequest(
    dto: CreateReturnRequestDto,
  ): Promise<ReturnRequest> {
    const {
      orderId,
      buyerId,
      sellerId,
      reason,
      reasonDescription,
      refundType,
      items,
      returnWindowDays,
    } = dto;

    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    // Ownership validation (from your feature branch)
    if (order.buyerId !== buyerId) {
      throw new ForbiddenException(
        'You can only request returns for your own orders',
      );
    }

    // Must be delivered
    if (order.status !== 'delivered') {
      throw new BadRequestException(
        'Only delivered orders can be refunded',
      );
    }

    // Refund window validation (merged from your branch)
    if (!order.deliveredAt) {
      throw new BadRequestException(
        'Order has no delivery date recorded',
      );
    }

    const maxReturnDays = returnWindowDays || DEFAULT_RETURN_WINDOW_DAYS;
    const diffDays =
      (Date.now() - order.deliveredAt.getTime()) /
      (1000 * 60 * 60 * 24);

    if (diffDays > maxReturnDays) {
      throw new BadRequestException(
        `Return window of ${maxReturnDays} days has expired`,
      );
    }

    // Prevent duplicate pending requests (from your feature branch)
    const existing = await this.returnRequestRepository.findOne({
      where: { orderId, status: ReturnStatus.PENDING },
    });

    if (existing) {
      throw new BadRequestException(
        'A pending return request already exists for this order',
      );
    }

    let requestedAmount: number;
    const finalRefundType = refundType || RefundType.FULL;

    if (finalRefundType === RefundType.FULL) {
      requestedAmount = Number(order.totalAmount);
    } else {
      if (!items || items.length === 0) {
        throw new BadRequestException(
          'Partial refund requires specifying items',
        );
      }

      requestedAmount = 0;

      for (const item of items) {
        const orderItem = order.items?.find(
          (i) => i.productId === item.listingId,
        );

        if (!orderItem) {
          throw new BadRequestException(
            `Item ${item.listingId} not found in order`,
          );
        }

        requestedAmount += orderItem.price * item.quantity;
      }
    }

    const returnRequest = this.returnRequestRepository.create({
      orderId,
      buyerId,
      sellerId,
      reason,
      reasonDescription,
      status: ReturnStatus.PENDING,
      refundType: finalRefundType,
      requestedAmount,
      currency: order.currency,
      items,
      returnWindowDays: maxReturnDays,
    });

    const saved = await this.returnRequestRepository.save(returnRequest);

    this.eventEmitter.emit('return.requested', {
      returnRequestId: saved.id,
      orderId,
      buyerId,
      sellerId,
    });

    this.logger.log(
      `Created return request ${saved.id} for order ${orderId}`,
    );

    return saved;
  }

  // ─────────────────────────────────────────────────────────────
  // REVIEW RETURN REQUEST
  // ─────────────────────────────────────────────────────────────

  async reviewReturnRequest(
    id: string,
    dto: ReviewReturnRequestDto,
    reviewerId: string,
  ): Promise<ReturnRequest> {
    const returnRequest = await this.returnRequestRepository.findOne({
      where: { id },
    });

    if (!returnRequest) {
      throw new NotFoundException(
        `Return request ${id} not found`,
      );
    }

    if (returnRequest.status !== ReturnStatus.PENDING) {
      throw new BadRequestException(
        'Can only review pending return requests',
      );
    }

    const { action, notes, approvedAmount } = dto;

    if (action === 'approved') {
      returnRequest.status = ReturnStatus.APPROVED;

      // Prevent approving more than requested (from your feature branch)
      if (
        approvedAmount &&
        approvedAmount > returnRequest.requestedAmount
      ) {
        throw new BadRequestException(
          'Approved amount cannot exceed requested amount',
        );
      }

      if (approvedAmount) {
        returnRequest.requestedAmount = approvedAmount;
      }
    } else {
      returnRequest.status = ReturnStatus.REJECTED;
    }

    returnRequest.reviewedBy = reviewerId;
    returnRequest.reviewedAt = new Date();
    returnRequest.reviewNotes = notes;

    const saved =
      await this.returnRequestRepository.save(returnRequest);

    this.eventEmitter.emit('return.reviewed', {
      returnRequestId: saved.id,
      status: saved.status,
      buyerId: saved.buyerId,
      sellerId: saved.sellerId,
    });

    return saved;
  }
}