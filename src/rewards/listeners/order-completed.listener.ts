import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { RewardsService } from '../rewards.service';
import { OrderCompletedEvent } from '../../common/events';

@Injectable()
export class OrderCompletedListener {
  private readonly logger = new Logger(OrderCompletedListener.name);

  constructor(private readonly rewardsService: RewardsService) {}

  @OnEvent('order.completed')
  async handleOrderCompleted(event: OrderCompletedEvent) {
    try {
      this.logger.log(
        `Processing reward points for completed order: ${event.orderId}`,
      );

      await this.rewardsService.grantPointsForOrder(
        event.userId,
        event.orderId,
        event.totalAmount,
      );

      this.logger.log(
        `Successfully granted reward points for order: ${event.orderId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to grant reward points for order ${event.orderId}: ${error.message}`,
        error.stack,
      );
      // Don't throw - we don't want to fail the order completion if rewards fail
    }
  }
}
