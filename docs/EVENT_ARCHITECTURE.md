# Event, Messaging & Background Jobs Architecture

## Overview

MarketX uses two complementary async layers:

| Layer | Technology | Purpose |
|---|---|---|
| In-process events | `@nestjs/event-emitter` (EventEmitter2) | Synchronous cross-module fan-out within the same process |
| Broker broadcast | RabbitMQ (`amqp-connection-manager`) | Durable fan-out to external consumers via `marketx.domain-events` (fanout exchange) |
| Background queues | BullMQ / Bull (`@nestjs/bull` + Redis) | Scheduled/retry jobs (email, image processing, recommendations) |

The `RabbitMqService` (`src/messaging/rabbitmq.module.ts`) bridges the two: it subscribes to **all** EventEmitter2 events via `onAny` and republishes them as JSON envelopes on the RabbitMQ exchange.

---

## Event Name Registry

All canonical event names live in `src/common/events.ts` → `EventNames`.  
**Always use the constants, never raw strings**, to prevent the class of bug that caused `payment.received` ≠ `payment.confirmed`.

### Domain events

| Event name (constant) | Emitter (owner) | Listener(s) |
|---|---|---|
| `order.created` | `OrdersService` / `OrdersController` | `NotificationEventListener` |
| `order.updated` | `OrdersService` / `OrdersController` | `NotificationEventListener` |
| `order.cancelled` | `OrdersService` | `NotificationEventListener` |
| `order.completed` | `OrdersService` | `NotificationEventListener` |
| `payment.initiated` | `PaymentsService` | _(monitoring/audit)_ |
| `payment.confirmed` | `PaymentsService` | `NotificationEventListener` |
| `payment.failed` | `PaymentsService` | `NotificationEventListener` |
| `payment.timeout` | `PaymentsService` | _(monitoring)_ |
| `payment.stream.confirmed` | `PaymentMonitorService` | _(escrow)_ |
| `payment.released` | `EscrowAutoReleaseTask` | _(downstream)_ |
| `user.created` | `UsersService` | _(analytics/audit)_ |
| `user.password_changed` | `AuthService` | `AuditListener` |
| `user.email_changed` | `AuthService` | `AuditListener` |
| `user.profile_updated` | `AuthService` | `AuditListener` |
| `user.permissions_changed` | `AuthService` | `AuditListener` |
| `auth.password_reset_requested` | `AuthService` | `NotificationEventListener` |
| `wallet.withdrawal_requested` | `WalletService` | `AuditListener` |
| `wallet.withdrawal_completed` | `WalletService` | `AuditListener` |
| `wallet.deposit_requested` | `WalletService` | _(downstream)_ |
| `refund.requested` | `RefundsService` | `RefundsListener` |
| `refund.processed` | `RefundsService` | `RefundsListener` |
| `refund.rejected` | `RefundsService` | `RefundsListener` |
| `refund.failed` | `RefundsService` | `RefundsListener` |
| `refund.inventory.restore` | `RefundsService` | `RefundsListener` |
| `inventory.low_stock` | `InventoryService` | _(notifications)_ |
| `product.price.updated` | `ProductsService` | _(notifications/search)_ |
| `shipment.created` | `ShippingService` | _(notifications)_ |
| `shipment.status_updated` | `ShippingService` | _(notifications)_ |
| `message.received` | _(MessagesService — pending wiring)_ | `NotificationEventListener` |
| `account.modified` | `AuthService` | `AuditListener` |

### Internal notification lifecycle events

| Event name | Emitter | Notes |
|---|---|---|
| `notification.created` | `NotificationsService` | WebSocket gateway push |
| `notification.read` | `NotificationsService` | analytics |
| `notification.send_push` | `NotificationsService` | push delivery |
| `notification.retry.started` | `RetryStrategyService` | observability |
| `notification.retry.succeeded` | `RetryStrategyService` | observability |
| `notification.retry.attempt_failed` | `RetryStrategyService` | observability |
| `notification.retry.exhausted` | `RetryStrategyService` | routes to DLQ |
| `dlq.entry.created` | `DeadLetterQueueService` | observability |
| `dlq.entry.status_changed` | `DeadLetterQueueService` | observability |
| `dlq.entry.retry` | `DeadLetterQueueService` | retry pipeline |
| `dlq.entry.deleted` | `DeadLetterQueueService` | audit |
| `dlq.cleanup.completed` | `DeadLetterQueueService` | maintenance |

### WebSocket (Socket.IO) events — client-facing

| Event name | Gateway | Direction |
|---|---|---|
| `userOnline` / `userOffline` | `ChatGateway` | server → all |
| `joinedRoom` / `error` | `ChatGateway` | server → client |
| `newMessage` | `ChatGateway` | server → room |
| `messageStatusUpdated` | `ChatGateway` | server → all |
| `notification` | `NotificationGateway` | server → user room |
| `userAnalyticsUpdate` | `AnalyticsGateway` | server → user |
| `platformAnalyticsUpdate` | `AnalyticsGateway` | server → all |

---

## Bull Queues

Defined in `src/job-processing/queue.constants.ts`, registered globally in `JobsModule`.

| Queue constant | Queue name | Job name | Owner module |
|---|---|---|---|
| `EMAIL_QUEUE` | `email-queue` | `send-email` | EmailModule |
| `LEGACY_EMAIL_QUEUE` | `email` | `send-email` | EmailModule (legacy) |
| `IMAGE_PROCESSING_QUEUE` | `image-processing-queue` | `process-product-image` | MediaModule |
| `RECOMMENDATIONS_QUEUE` | `recommendations-queue` | `refresh-user-recommendations` | RecommendationModule |
| _(inline)_ | `orders` | _(order jobs)_ | OrdersModule |
| _(inline)_ | `notifications` | _(notification delivery)_ | NotificationsModule |

---

## RabbitMQ

- **Exchange**: `marketx.domain-events` (fanout, durable)
- **Envelope schema**: `EventEnvelope` from `src/common/event-contracts.ts`
- **Headers**: `x-event-type`, `x-domain`, `x-schema-version`, `x-event-id`
- **Config**: `AMQP_URL` or `RABBITMQ_URL` env variable (default: `amqp://rabbitmq:5672`)

All in-process EventEmitter2 events are automatically bridged to RabbitMQ.  
External consumers bind their own queues to the fanout exchange and filter by `x-event-type` header.

---

## Ownership Boundaries

```
┌─────────────────────────────────────────────────────────────────┐
│  Domain modules (Orders, Payments, Auth, Wallet, Refunds, …)    │
│  emit EventEmitter2 events using EventNames constants           │
└──────────────────┬──────────────────────────────────────────────┘
                   │ in-process fan-out
        ┌──────────┴──────────┐
        │                     │
┌───────▼──────┐   ┌──────────▼──────────────────────────────────┐
│ Listeners    │   │ RabbitMqService (src/messaging)              │
│ (sync, same  │   │ bridges ALL events → RabbitMQ fanout exchange│
│  process)    │   └─────────────────────────────────────────────┘
│              │
│ • NotificationEventListener  → NotificationsService
│ • AuditListener              → AuditService
│ • RefundsListener            → InventoryService
└──────────────┘

NotificationsService
  ├── persists to DB
  ├── emits notification.* events
  ├── NotificationGateway (WebSocket push)
  ├── RetryStrategyService (exponential back-off)
  └── DeadLetterQueueService (DLQ + manual replay)

JobsModule (Bull/BullMQ + Redis)
  ├── email-queue     → EmailService
  ├── image-processing-queue → MediaService
  ├── recommendations-queue  → RecommendationService
  ├── orders          → OrdersService
  └── notifications   → NotificationsService
```

---

## Known Issues Fixed

| Issue | Root cause | Fix |
|---|---|---|
| Payment success notification never fired | Listener subscribed to `payment.received`; service emits `payment.confirmed` | Listener updated to `EventNames.PAYMENT_CONFIRMED` |
| `user.created` emitted as raw string, missing from EventNames | No constant defined | `USER_CREATED` added to `EventNames` |

## Rules for Contributors

1. **Register new events** in `EventNames` (`src/common/events.ts`) before emitting.
2. **Define typed event classes** in `src/common/events.ts` for cross-domain events, or in `src/notifications/events/` for notification-internal ones.
3. **Never hardcode event name strings** in `@OnEvent()` or `eventEmitter.emit()` — always use the constant.
4. **New Bull queues** must be added to `queue.constants.ts` and registered in `JobsModule`.

## Integrated Test Coverage

- End-to-end notification flow coverage lives in `test/notifications-flow.e2e-spec.ts`.
- It validates `order.created` listener handling, channel dispatch (`in_app` and `email`), queue enqueue behavior, and preference-based filtering.
