# Event-Driven Pub/Sub Architecture

## Overview

This document describes the standardized event-driven pub/sub architecture implemented in the MarketX-backend project. The architecture decouples business logic from side-effects (email, notifications, analytics, etc.) by using the `@nestjs/event-emitter` package.

## Key Principles

1. **Controllers emit events**: Primary controllers should only emit events after completing business logic
2. **Listeners handle side-effects**: Modular listeners execute side-effects (email, notifications, analytics, etc.)
3. **Strictly typed events**: All events are defined as classes with strict typing in `src/common/events.ts`
4. **Event naming convention**: Events follow the pattern `domain.action` (e.g., `order.created`, `payment.confirmed`)

## Event Dictionary

All application events are defined in [`src/common/events.ts`](../src/common/events.ts). This file contains:

- **Event Classes**: Strictly typed event classes for each domain
- **Event Name Constants**: Centralized event name constants to prevent typos

### Event Categories

#### Order Events
- `OrderCreatedEvent` - Emitted when a new order is created
- `OrderUpdatedEvent` - Emitted when order status changes
- `OrderCancelledEvent` - Emitted when an order is cancelled
- `OrderCompletedEvent` - Emitted when an order is completed

#### Payment Events
- `PaymentInitiatedEvent` - Emitted when payment is initiated
- `PaymentConfirmedEvent` - Emitted when payment is confirmed
- `PaymentFailedEvent` - Emitted when payment fails
- `PaymentTimeoutEvent` - Emitted when payment times out
- `PaymentStreamConfirmedEvent` - Emitted when payment stream is confirmed

#### User/Auth Events
- `UserPasswordChangedEvent` - Emitted when user changes password
- `UserEmailChangedEvent` - Emitted when user changes email
- `UserProfileUpdatedEvent` - Emitted when user profile is updated
- `UserPermissionsChangedEvent` - Emitted when user permissions change
- `AuthPasswordResetRequestedEvent` - Emitted when password reset is requested

#### Wallet Events
- `WalletWithdrawalRequestedEvent` - Emitted when withdrawal is requested
- `WalletWithdrawalCompletedEvent` - Emitted when withdrawal is completed
- `WalletDepositRequestedEvent` - Emitted when deposit is requested

#### Refund/Return Events
- `ReturnRequestedEvent` - Emitted when return is requested
- `ReturnReviewedEvent` - Emitted when return is reviewed
- `RefundRequestedEvent` - Emitted when refund is requested
- `RefundProcessedEvent` - Emitted when refund is processed
- `RefundRejectedEvent` - Emitted when refund is rejected
- `RefundFailedEvent` - Emitted when refund fails
- `RefundInventoryRestoreEvent` - Emitted when inventory is restored from refund

#### Inventory Events
- `InventoryLowStockEvent` - Emitted when inventory is low

#### Product Events
- `ProductPriceUpdatedEvent` - Emitted when product price is updated

#### Notification Events
- `NotificationCreatedEvent` - Emitted when notification is created
- `NotificationSendPushEvent` - Emitted to send push notification
- `NotificationReadEvent` - Emitted when notification is read

#### Message Events
- `MessageReceivedEvent` - Emitted when message is received

#### Shipping Events
- `ShipmentCreatedEvent` - Emitted when shipment is created
- `ShipmentStatusUpdatedEvent` - Emitted when shipment status changes

#### Account Events
- `AccountModifiedEvent` - Emitted when account is modified

## Usage Examples

### Emitting Events from Controllers

```typescript
import { Controller, Post, Body } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OrdersService } from './orders.service';
import { OrderCreatedEvent, EventNames } from '../common/events';

@Controller('orders')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Post()
  async create(@Body() createOrderDto: CreateOrderDto) {
    const order = await this.ordersService.create(createOrderDto);
    
    // Emit order.created event for side-effects
    this.eventEmitter.emit(
      EventNames.ORDER_CREATED,
      new OrderCreatedEvent(
        order.id,
        order.buyerId,
        `ORD-${order.id.substring(0, 8)}`,
        order.totalAmount,
        order.items,
        order.currency,
      ),
    );
    
    return order;
  }
}
```

### Emitting Events from Services

```typescript
import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PaymentConfirmedEvent, EventNames } from '../common/events';

@Injectable()
export class PaymentsService {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  async confirmPayment(paymentId: string) {
    // ... payment confirmation logic
    
    // Emit payment.confirmed event
    this.eventEmitter.emit(
      EventNames.PAYMENT_CONFIRMED,
      new PaymentConfirmedEvent(
        paymentId,
        orderId,
        amount,
        currency,
        stellarTransactionId,
      ),
    );
  }
}
```

### Creating Event Listeners

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { OrderCreatedEvent } from '../common/events';
import { EmailService } from '../email/email.service';

@Injectable()
export class OrderEmailListener {
  private readonly logger = new Logger(OrderEmailListener.name);

  constructor(private readonly emailService: EmailService) {}

  @OnEvent('order.created', { async: true })
  async handleOrderCreated(event: OrderCreatedEvent): Promise<void> {
    this.logger.debug(`order.created event received for order ${event.orderId}`);
    
    try {
      await this.emailService.sendOrderConfirmation({
        orderId: event.orderId,
        userId: event.userId,
        orderNumber: event.orderNumber,
        total: event.totalAmount,
        items: event.items,
      });
    } catch (err) {
      this.logger.error(
        `Failed to send order confirmation for order ${event.orderId}: ${err.message}`,
      );
    }
  }
}
```

## Existing Listeners

The following listeners are already implemented:

1. **AuditEventListener** ([`src/audit/audit.listener.ts`](../src/audit/audit.listener.ts))
   - Listens to: `user.password_changed`, `user.email_changed`, `wallet.withdrawal_requested`, `wallet.withdrawal_completed`, `user.profile_updated`, `account.modified`, `user.permissions_changed`
   - Purpose: Logs critical account modifications for compliance

2. **NotificationEventListener** ([`src/notifications/listeners/notification-event.listener.ts`](../src/notifications/listeners/notification-event.listener.ts))
   - Listens to: `order.created`, `order.updated`, `order.cancelled`, `order.completed`, `payment.received`, `payment.failed`, `message.received`, `auth.password_reset_requested`
   - Purpose: Creates in-app notifications for users

3. **OrderEmailListener** ([`src/email/listeners/order-email.listener.ts`](../src/email/listeners/order-email.listener.ts))
   - Listens to: `order.created`, `order.updated`
   - Purpose: Sends order confirmation and shipping update emails

4. **RefundsListener** ([`src/refunds/refunds.listener.ts`](../src/refunds/refunds.listener.ts))
   - Listens to: `refund.requested`, `refund.processed`, `refund.rejected`, `refund.failed`, `refund.inventory.restore`
   - Purpose: Creates notifications for refund status changes

## Benefits

1. **Decoupling**: Controllers focus on business logic, listeners handle side-effects
2. **Testability**: Easy to test controllers without worrying about side-effects
3. **Maintainability**: Side-effects are isolated in separate listeners
4. **Extensibility**: Easy to add new side-effects without modifying existing code
5. **Type Safety**: Strictly typed events prevent runtime errors

## Migration Guide

When adding new features:

1. Define event class in [`src/common/events.ts`](../src/common/events.ts)
2. Add event name constant to `EventNames` object
3. Emit event from controller/service after business logic completes
4. Create listener for side-effects (email, notifications, etc.)
5. Register listener in appropriate module

## Best Practices

1. **Always use event classes**: Never emit plain objects, always use typed event classes
2. **Use EventNames constants**: Never hardcode event name strings
3. **Keep events immutable**: Use `readonly` properties in event classes
4. **Handle errors in listeners**: Always catch and log errors in listeners
5. **Use async listeners**: Use `{ async: true }` option for non-blocking operations
6. **Document events**: Add JSDoc comments to event classes explaining when they're emitted
