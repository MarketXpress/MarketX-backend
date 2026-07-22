import {
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
  UpdateEvent,
} from 'typeorm';
import { Order, OrderStatus } from '../entities/order.entity';
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
    [OrderStatus.PENDING]: [
      OrderStatus.CONFIRMED,
      OrderStatus.CANCELLED,
      OrderStatus.MANUAL_REVIEW,
    ],
    [OrderStatus.CONFIRMED]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
    [OrderStatus.PROCESSING]: [OrderStatus.PAID, OrderStatus.CANCELLED],
    [OrderStatus.PAID]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
    [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
    [OrderStatus.DELIVERED]: [OrderStatus.COMPLETED, OrderStatus.REFUNDED],
    [OrderStatus.COMPLETED]: [OrderStatus.REFUNDED],
    [OrderStatus.CANCELLED]: [],
    [OrderStatus.REFUNDED]: [],
    [OrderStatus.MANUAL_REVIEW]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  };

  listenTo() {
    return Order;
  }

  beforeInsert(event: InsertEvent<Order>): void {
    // For new orders, ensure status starts as PENDING
    if (event.entity.status && event.entity.status !== OrderStatus.PENDING) {
      throw new BadRequestException(
        `New orders must start with status ${OrderStatus.PENDING}. Invalid status: ${event.entity.status}`,
      );
    }
  }

  beforeUpdate(event: UpdateEvent<Order>): void {
    if (!event.entity || !event.databaseEntity) {
      return;
    }

    const newStatus = event.entity.status as OrderStatus | undefined;
    const oldStatus = event.databaseEntity.status as OrderStatus | undefined;

    // Skip validation if status hasn't changed or is undefined
    if (!newStatus || !oldStatus || newStatus === oldStatus) {
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
