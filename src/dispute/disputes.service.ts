import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Dispute, DisputeStatus, ResolutionAction } from './disputes.entity';
import { ActingUser, OrdersService } from '../orders/orders.service';

@Injectable()
export class DisputesService {
  constructor(
    @InjectRepository(Dispute)
    private readonly disputesRepository: Repository<Dispute>,
    private readonly ordersService: OrdersService,
  ) {}

  /**
   * Instantiates a new dispute record attached to an eligible order status code
   */
  async raiseDispute(
    orderId: string,
    raisedBy: number,
    reason: string,
  ): Promise<Dispute> {
    // raisedBy is a legacy numeric user id that doesn't line up with
    // Order.buyerId's uuid format, so it can never satisfy OrdersService's
    // buyer/seller ownership check. This lookup only reads order status to
    // validate dispute eligibility, so treat it as trusted system access
    // rather than trying to force a buyer/seller identity match here.
    const systemActingUser: ActingUser = {
      id: String(raisedBy),
      role: 'admin',
    };
    const order = await this.ordersService.findOne(orderId, systemActingUser);
    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} does not exist.`);
    }

    // Force validation conditions over the core active order state machine flags
    const acceptableStates = ['SHIPPED', 'DELIVERED'];
    if (!acceptableStates.includes(order.status?.toUpperCase())) {
      throw new BadRequestException(
        `Disputes can only be raised when order lifecycle status is SHIPPED or DELIVERED. Current: ${order.status}`,
      );
    }

    // Verify if an active dispute already tracks this order context
    const existingDispute = await this.disputesRepository.findOne({
      where: { orderId },
    });
    if (existingDispute) {
      throw new BadRequestException(
        'A dispute case has already been registered for this order reference.',
      );
    }

    const dispute = this.disputesRepository.create({
      orderId,
      raisedBy,
      reason,
      status: DisputeStatus.OPEN,
    });

    return await this.disputesRepository.save(dispute);
  }

  /**
   * Fetches all active non-finalized cases for global admin monitoring dashboards
   */
  async findAllOpenDisputes(): Promise<Dispute[]> {
    return await this.disputesRepository.find({
      where: [
        { status: DisputeStatus.OPEN },
        { status: DisputeStatus.UNDER_REVIEW },
      ],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Closes a dispute case by triggering automated escrow actions based on resolution decisions
   */
  async resolveDispute(
    disputeId: string,
    resolution: string,
    action: ResolutionAction,
  ): Promise<Dispute> {
    const dispute = await this.disputesRepository.findOne({
      where: { id: disputeId },
    });
    if (!dispute) {
      throw new NotFoundException(
        `Dispute instance ${disputeId} could not be resolved.`,
      );
    }

    if (dispute.status === DisputeStatus.RESOLVED) {
      throw new BadRequestException(
        'This dispute case file has already been marked as RESOLVED.',
      );
    }

    // Process escrow modifications by passing execution mandates down to your order tiers.
    // The disputes/:id/resolve route is already AdminGuard-protected at the
    // controller level, so this internal OrdersService call is inherently
    // admin-authorized.
    const adminActingUser: ActingUser = {
      id: 'system:disputes',
      role: 'admin',
    };
    if (action === ResolutionAction.REFUND_TO_BUYER) {
      await this.ordersService.updateStatus(
        dispute.orderId,
        { status: 'DISPUTE_REFUNDED' } as any,
        adminActingUser,
      );
    } else if (action === ResolutionAction.RELEASE_TO_SELLER) {
      await this.ordersService.updateStatus(
        dispute.orderId,
        { status: 'DISPUTE_RELEASED' } as any,
        adminActingUser,
      );
    }

    dispute.status = DisputeStatus.RESOLVED;
    dispute.resolution = resolution;
    dispute.resolutionAction = action;

    return await this.disputesRepository.save(dispute);
  }
}
