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
import { ReturnRequest, ReturnStatus, RefundType } from './entities/return-request.entity';
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

@Injectable()
export class RefundsService {
  private readonly logger = new Logger(RefundsService.name);

  // Simulated Stellar service - in production, inject the actual StellarService
  private readonly stellarService = {
    processRefund: async (toAddress: string, amount: number, currency: string) => {
      // Simulate Stellar transaction
      this.logger.log(`Processing Stellar refund: ${amount} ${currency} to ${toAddress}`);
      return {
        success: true,
        transactionId: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      };
    },
  };

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

  /**
   * Create a new return request
   */
  async createReturnRequest(dto: CreateReturnRequestDto): Promise<ReturnRequest> {
    const { orderId, buyerId, sellerId, reason, reasonDescription, refundType, items, returnWindowDays } = dto;

    // Verify order exists and belongs to buyer
    const order = await this.orderRepository.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    if (order.buyerId !== buyerId) {
      throw new ForbiddenException('You can only request returns for your own orders');
    }

    // Check if order is eligible for return (must be delivered)
    if (order.status !== 'delivered') {
      throw new BadRequestException('Can only return delivered orders');
    }

    // Check return window
    if (order.deliveredAt) {
      const daysSinceDelivery = Math.floor(
        (Date.now() - order.deliveredAt.getTime()) / (1000 * 60 * 60 * 24),
      );
      const maxReturnDays = returnWindowDays || 30;
      if (daysSinceDelivery > maxReturnDays) {
        throw new BadRequestException(`Return window of ${maxReturnDays} days has expired`);
      }
    }

    // Calculate refund amount
    let requestedAmount: number;
    let finalRefundType = refundType || RefundType.FULL;

    if (finalRefundType === RefundType.FULL) {
      requestedAmount = Number(order.totalAmount);
    } else if (items && items.length > 0) {
      // Calculate partial refund based on items
      requestedAmount = 0;
      for (const item of items) {
        const orderItem = order.items?.find((i) => i.productId === item.listingId);
        if (orderItem) {
          requestedAmount += orderItem.price * item.quantity;
        }
      }
    } else {
      throw new BadRequestException('Partial refund requires specifying items');
    }

    // Create return request
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
      items: items?.map((item) => ({
        listingId: item.listingId,
        quantity: item.quantity,
        price: order.items?.find((i) => i.productId === item.listingId)?.price || 0,
      })),
      returnWindowDays: returnWindowDays || 30,
    });

    const saved = await this.returnRequestRepository.save(returnRequest);
    this.logger.log(`Created return request ${saved.id} for order ${orderId}`);

    // Emit event for notifications
    this.eventEmitter.emit('return.requested', {
      returnRequestId: saved.id,
      orderId,
      buyerId,
      sellerId,
    });

    return saved;
  }

  /**
   * Get return requests with filters
   */
  async getReturnRequests(dto: QueryReturnRequestsDto): Promise<{ data: ReturnRequest[]; total: number }> {
    const { buyerId, sellerId, status, orderId, limit = 20, offset = 0 } = dto;

    const query = this.returnRequestRepository.createQueryBuilder('rr');

    if (buyerId) {
      query.andWhere('rr.buyerId = :buyerId', { buyerId });
    }
    if (sellerId) {
      query.andWhere('rr.sellerId = :sellerId', { sellerId });
    }
    if (status) {
      query.andWhere('rr.status = :status', { status });
    }
    if (orderId) {
      query.andWhere('rr.orderId = :orderId', { orderId });
    }

    const total = await query.getCount();
    const data = await query
      .orderBy('rr.requestedAt', 'DESC')
      .skip(offset)
      .take(limit)
      .getMany();

    return { data, total };
  }

  /**
   * Get a single return request by ID
   */
  async getReturnRequest(id: string): Promise<ReturnRequest> {
    const returnRequest = await this.returnRequestRepository.findOne({
      where: { id },
    });
    if (!returnRequest) {
      throw new NotFoundException(`Return request ${id} not found`);
    }
    return returnRequest;
  }

  /**
   * Review a return request (approve or reject)
   * This is typically called by admin or seller
   */
  async reviewReturnRequest(
    id: string,
    dto: ReviewReturnRequestDto,
    reviewerId: string,
  ): Promise<ReturnRequest> {
    const returnRequest = await this.getReturnRequest(id);

    if (returnRequest.status !== ReturnStatus.PENDING) {
      throw new BadRequestException('Can only review pending return requests');
    }

    const { action, notes, approvedAmount } = dto;

    if (action === 'approved') {
      returnRequest.status = ReturnStatus.APPROVED;
      returnRequest.reviewedBy = reviewerId;
      returnRequest.reviewedAt = new Date();
      returnRequest.reviewNotes = notes;

      // If partial refund, update the amount
      if (returnRequest.refundType === RefundType.PARTIAL && approvedAmount) {
        returnRequest.requestedAmount = approvedAmount;
      }
    } else {
      returnRequest.status = ReturnStatus.REJECTED;
      returnRequest.reviewedBy = reviewerId;
      returnRequest.reviewedAt = new Date();
      returnRequest.reviewNotes = notes;
    }

    const saved = await this.returnRequestRepository.save(returnRequest);
    this.logger.log(`Return request ${id} ${action}`);

    // Emit event
    this.eventEmitter.emit('return.reviewed', {
      returnRequestId: saved.id,
      status: saved.status,
      buyerId: returnRequest.buyerId,
      sellerId: returnRequest.sellerId,
    });

    return saved;
  }

  /**
   * Process the refund - called when return is received and verified
   * Triggers Stellar refund transaction
   */
  async processRefund(dto: ProcessRefundDto): Promise<RefundHistory> {
    const { returnRequestId, processedBy, stellarRefundAddress, trackingNumber } = dto;

    const returnRequest = await this.getReturnRequest(returnRequestId);

    // Verify return is approved
    if (returnRequest.status !== ReturnStatus.APPROVED) {
      throw new BadRequestException('Can only process approved return requests');
    }

    // Get order details
    const order = await this.orderRepository.findOne({
      where: { id: returnRequest.orderId },
    });
    if (!order) {
      throw new NotFoundException(`Order ${returnRequest.orderId} not found`);
    }

    // Update return request status
    returnRequest.status = ReturnStatus.PROCESSING;
    returnRequest.trackingNumber = trackingNumber;
    await this.returnRequestRepository.save(returnRequest);

    // Create refund history entry
    const refundHistory = this.refundHistoryRepository.create({
      returnRequestId,
      orderId: order.id,
      buyerId: returnRequest.buyerId,
      sellerId: returnRequest.sellerId,
      refundType: returnRequest.refundType,
      refundAmount: returnRequest.requestedAmount || 0,
      originalAmount: Number(order.totalAmount),
      currency: returnRequest.currency,
      stellarRefundAddress,
      transactionStatus: 'pending',
      processedBy,
      metadata: {
        reason: returnRequest.reason,
        items: returnRequest.items,
      },
    });

    let stellarTransactionId: string | undefined;

    try {
      // Process Stellar refund if address provided
      if (stellarRefundAddress) {
        const result = await this.stellarService.processRefund(
          stellarRefundAddress,
          Number(returnRequest.requestedAmount),
          returnRequest.currency,
        );

        if (result.success) {
          stellarTransactionId = result.transactionId;
          refundHistory.stellarTransactionId = result.transactionId;
          refundHistory.transactionStatus = 'completed';
        }
      } else {
        // No Stellar address - mark as pending manual
        this.logger.warn(`No Stellar refund address provided for return ${returnRequestId}`);
        refundHistory.transactionStatus = 'pending';
      }

      // Update inventory - release reserved items back to stock
      if (returnRequest.items && returnRequest.items.length > 0) {
        for (const item of returnRequest.items) {
          await this.inventoryService.releaseInventory(
            item.listingId,
            processedBy,
            item.quantity,
          );
        }
        this.logger.log(`Released inventory for return ${returnRequestId}`);
      }

      // Complete the return request
      returnRequest.status = ReturnStatus.COMPLETED;
      returnRequest.completedAt = new Date();
      await this.returnRequestRepository.save(returnRequest);

      // Save refund history
      const savedHistory = await this.refundHistoryRepository.save(refundHistory);

      // Emit events
      this.eventEmitter.emit('refund.processed', {
        refundId: savedHistory.id,
        returnRequestId,
        orderId: order.id,
        amount: returnRequest.requestedAmount,
        buyerId: returnRequest.buyerId,
      });

      this.eventEmitter.emit('order.refunded', {
        orderId: order.id,
        refundAmount: returnRequest.requestedAmount,
      });

      this.logger.log(`Processed refund ${savedHistory.id} for return ${returnRequestId}`);
      return savedHistory;
    } catch (error) {
      // Handle Stellar transaction failure
      this.logger.error(`Stellar refund failed for return ${returnRequestId}`, error);
      refundHistory.transactionStatus = 'failed';
      refundHistory.failureReason = error.message || 'Stellar transaction failed';
      
      // Still save the history for tracking
      return this.refundHistoryRepository.save(refundHistory);
    }
  }

  /**
   * Get refund history for an order
   */
  async getRefundHistoryByOrder(orderId: string): Promise<RefundHistory[]> {
    return this.refundHistoryRepository.find({
      where: { orderId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get all refund history for admin
   */
  async getAllRefundHistory(limit = 50, offset = 0): Promise<{ data: RefundHistory[]; total: number }> {
    const query = this.refundHistoryRepository.createQueryBuilder('rh')
      .leftJoinAndSelect('rh.buyer', 'buyer')
      .leftJoinAndSelect('rh.seller', 'seller')
      .leftJoinAndSelect('rh.processedByUser', 'processedByUser');

    const total = await query.getCount();
    const data = await query
      .orderBy('rh.createdAt', 'DESC')
      .skip(offset)
      .take(limit)
      .getMany();

    return { data, total };
  }

  /**
   * Cancel a return request (buyer changed mind)
   */
  async cancelReturnRequest(id: string, userId: string): Promise<ReturnRequest> {
    const returnRequest = await this.getReturnRequest(id);

    // Only buyer can cancel
    if (returnRequest.buyerId !== userId) {
      throw new ForbiddenException('Only the buyer can cancel their return request');
    }

    // Only pending returns can be cancelled
    if (returnRequest.status !== ReturnStatus.PENDING) {
      throw new BadRequestException('Can only cancel pending return requests');
    }

    returnRequest.status = ReturnStatus.REJECTED; // Using REJECTED for cancelled
    returnRequest.reviewNotes = 'Cancelled by buyer';
    returnRequest.completedAt = new Date();

    return this.returnRequestRepository.save(returnRequest);
  }
}
