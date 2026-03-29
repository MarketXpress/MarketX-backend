import {
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
  UpdateEvent,
} from 'typeorm';
import { Order } from '../entities/order.entity';
import { OrderStatus } from '../dto/create-order.dto';
import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';

@EventSubscriber()
export class OrderStateSubscriber implements EntitySubscriberInterface<Order> {
  // Define strict state transition dictionary
  private static readonly VALID_STATE_TRANSITIONS: {
    [key in OrderStatus]: OrderStatus[];
  } = {
    [OrderStatus.PENDING]: [OrderStatus.PAID, OrderStatus.CANCELLED],
    [OrderStatus.PAID]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
    [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
    [OrderStatus.DELIVERED]: [OrderStatus.COMPLETED],
    [OrderStatus.CANCELLED]: [],
    [OrderStatus.COMPLETED]: [],
  };

  listenTo() {
    return Order;
  }

  async beforeInsert(event: InsertEvent<Order>): Promise<void> {
    // For new orders, ensure status starts as PENDING
    if (event.entity.status && event.entity.status !== OrderStatus.PENDING) {
      throw new BadRequestException(
        `New orders must start with status ${OrderStatus.PENDING}. Invalid status: ${event.entity.status}`,
      );
    }
  }

  async beforeUpdate(event: UpdateEvent<Order>): Promise<void> {
    if (!event.entity || !event.databaseEntity) {
      return;
    }

    const newStatus = event.entity.status;
    const oldStatus = event.databaseEntity.status;

    // Skip validation if status hasn't changed
    if (!newStatus || newStatus === oldStatus) {
      return;
    }

    // Validate state transition
    if (!this.isValidStateTransition(oldStatus, newStatus)) {
      throw new InternalServerErrorException(
        `Illegal state transition attempt: ${oldStatus} -> ${newStatus}. This violates the order state machine.`,
      );
    }
  }

  private isValidStateTransition(
    currentStatus: OrderStatus,
    newStatus: OrderStatus,
  ): boolean {
    const allowedTransitions =
      OrderStateSubscriber.VALID_STATE_TRANSITIONS[currentStatus] || [];
    return allowedTransitions.includes(newStatus);
  }
}
