# Notifications, Messaging, and Background Jobs Implementation

## Overview

This document describes the implementation of 4 critical tasks related to event contracts, message publishing, retry strategies, and dead-letter queue handling for the MarketX backend system.

## Tasks Completed

### ✅ Task 5: Queue and Broker Health Probes

**Problem:** Health endpoints did not clearly expose message broker and queue infrastructure status.

**Solution:** Added explicit RabbitMQ and Bull queue readiness/liveness indicators and integrated them into `/health`, `/health/ready`, and `/health/live`.

#### Files Created/Modified:
- `src/health/indicators/rabbitmq.indicator.ts` - RabbitMQ readiness/liveness checks
- `src/health/indicators/queues.indicator.ts` - Bull queue connectivity and liveness checks
- `src/health/health.controller.ts` - Added queue-related checks to health probes
- `src/health/health.module.ts` - Registered indicators and module dependencies
- `src/messaging/rabbitmq.service.ts` - Added connectivity state helpers for health checks

#### Probe Behavior:
- **`GET /health/live`**: application process + queue subsystem liveness
- **`GET /health/ready`**: database + stellar + cache + RabbitMQ + Bull queue connectivity
- **`GET /health`**: full composite check with all readiness dependencies and memory/cache metrics

### ✅ Task 6: Idempotency in Async Consumers

**Problem:** Queue retries and event replays could duplicate side effects (emails, recommendation refreshes, image processing).

**Solution:** Added a shared idempotency service with TTL-backed keys and applied guards in critical async consumers/listeners.

#### Files Created/Modified:
- `src/common/idempotency/idempotency.service.ts` - shared idempotent execution helper
- `src/common/idempotency/idempotency.module.ts` - global module export
- `src/common/idempotency/idempotency.service.spec.ts` - behavior tests
- `src/email/email.processor.ts` - dedupe email job side effects
- `src/media/media.processor.ts` - dedupe image processing side effects
- `src/recommendation/recommendation.processor.ts` - dedupe recommendation refresh side effects
- `src/email/listeners/order-email.listener.ts` - dedupe event-driven order emails

#### Key behavior:
- Consumers derive an idempotency key from payload/job identity.
- `executeOnce(key, operation)` runs side effects once and marks completion.
- Retries/replays with the same key are safely skipped.

### ✅ Task 1: Shared Event Contracts

**Problem:** Event producers and consumers were using inconsistent payload shapes across domains.

**Solution:** Implemented a unified event contract system with validation.

#### Files Created/Modified:
- `src/common/event-contracts.ts` - Event contract interfaces and utilities
- `src/common/event-contracts.spec.ts` - Comprehensive tests
- `src/messaging/rabbitmq.service.ts` - Updated to use event contracts

#### Key Features:
- **BaseEventContract Interface**: Ensures all events have required fields (eventId, eventType, occurredAt, domain, schemaVersion)
- **EventEnvelope**: Wraps domain-specific payloads with metadata
- **Validation**: `validateEventContract()` function to ensure contract compliance
- **Factory Functions**: `createBaseEventContract()` and `createEventEnvelope()` for consistent event creation
- **Tracing Support**: correlationId and causationId for distributed tracing

#### Example Usage:
```typescript
import { createEventEnvelope, validateEventContract } from '../common/event-contracts';

// Create a validated event envelope
const envelope = createEventEnvelope(
  'order',
  'order.created',
  { orderId: '123', amount: 100 },
  { correlationId: 'corr_456' }
);

// Validate before publishing
if (validateEventContract(envelope)) {
  // Safe to publish
}
```

---

### ✅ Task 2: Fix Message Publish Options

**Problem:** Messaging layer included publish options that didn't match current library types.

**Solution:** Updated RabbitMQ publish code to use properly typed amqplib options.

#### Files Modified:
- `src/messaging/rabbitmq.service.ts`

#### Key Changes:
- **Proper Type Safety**: Uses `Options.Publish` from amqplib instead of `as any`
- **Enhanced Headers**: Added metadata headers for event tracing:
  - `x-event-type`: Event type name
  - `x-domain`: Domain identifier
  - `x-schema-version`: Event schema version
  - `x-event-id`: Unique event identifier
- **Content Metadata**: Proper contentType and contentEncoding
- **Timestamp**: Unix timestamp for message ordering
- **Error Handling**: Comprehensive try-catch with logging

#### Before:
```typescript
await this.channel.publish(this.exchange, '', body, {
  contentType: 'application/json',
  persistent: true,
  type: eventName,
} as any); // ❌ Type unsafe
```

#### After:
```typescript
const publishOptions: Options.Publish = {
  contentType: 'application/json',
  contentEncoding: 'utf-8',
  persistent: true,
  type: eventName,
  timestamp: Math.floor(Date.now() / 1000),
  headers: {
    'x-event-type': eventName,
    'x-domain': domain,
    'x-schema-version': envelope.schemaVersion,
    'x-event-id': envelope.eventId,
  },
}; // ✅ Fully typed

await this.channel.publish(this.exchange, '', body, publishOptions);
```

---

### ✅ Task 3: Retry Strategy with Bounded Backoff

**Problem:** Failed outbound notification attempts failed silently or immediately without retries.

**Solution:** Implemented a structured retry strategy with exponential backoff and observability.

#### Files Created:
- `src/notifications/retry-strategy.service.ts` - Retry strategy implementation
- `src/notifications/retry-strategy.service.spec.ts` - Comprehensive tests

#### Key Features:
- **Exponential Backoff**: Delay increases exponentially with each retry
- **Bounded Delays**: Maximum delay cap prevents excessive waiting
- **Jitter Support**: Randomizes delays to prevent thundering herd problem
- **Configurable Policies**: Different retry configs per notification type:
  - Email: 5 retries, 2s initial, 60s max
  - Push: 3 retries, 1s initial, 30s max
  - SMS: 4 retries, 3s initial, 45s max
- **Observability Hooks**: Emits events for monitoring:
  - `notification.retry.started`
  - `notification.retry.succeeded`
  - `notification.retry.attempt_failed`
  - `notification.retry.exhausted`

#### Configuration:
```typescript
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  useJitter: true,
};
```

#### Example Usage:
```typescript
const retryService = new RetryStrategyService(eventEmitter);

const result = await retryService.executeWithRetry(
  async () => {
    await sendNotification(notification);
  },
  { maxRetries: 3, initialDelayMs: 1000 },
  { notificationId: notification.id }
);

if (!result.success) {
  // Handle failure after all retries exhausted
}
```

---

### ✅ Task 4: Dead-Letter Queue (DLQ) Handling

**Problem:** Job failures lacked operational visibility and triage capabilities.

**Solution:** Implemented DLQ routing with metadata for failed events and operational tools.

#### Files Created/Modified:
- `src/notifications/dead-letter-queue.service.ts` - DLQ service implementation
- `src/notifications/dead-letter-queue.service.spec.ts` - Comprehensive tests
- `src/notifications/notifications.service.ts` - Integrated DLQ routing
- `src/notifications/notifications.module.ts` - Added DLQ service

#### Key Features:
- **Automatic DLQ Routing**: Failed events routed after retry exhaustion
- **Rich Metadata**: Stores error details, retry history, and context
- **Status Tracking**: pending → investigating → resolved/discarded
- **Operational APIs**:
  - `getDLQEntries()` - Query and filter DLQ entries
  - `updateDLQEntryStatus()` - Update entry status
  - `retryDLQEntry()` - Retry a failed event
  - `getDLQStats()` - Get DLQ statistics and metrics
- **Automated Cleanup**: Cron job removes old resolved entries (30-day retention)
- **Observability**: Emits events for DLQ operations:
  - `dlq.entry.created`
  - `dlq.entry.status_changed`
  - `dlq.entry.retry`
  - `dlq.entry.deleted`
  - `dlq.cleanup.completed`

#### Database Entity:
```typescript
@Entity('dead_letter_queue')
export class DeadLetterQueueEntity {
  id: string;
  eventType: string;
  domain: string;
  originalPayload: any;
  error: { message: string; stack?: string; name: string };
  failureContext: { attempts: number; retryHistory: [...] };
  metadata: { eventId?: string; correlationId?: string; ... };
  status: 'pending' | 'investigating' | 'resolved' | 'discarded';
  createdAt: Date;
  updatedAt: Date;
}
```

#### Integration with Notifications:
```typescript
// In notifications.service.ts
if (!retryResult.success && this.deadLetterQueueService) {
  await this.deadLetterQueueService.routeToDLQ(
    `notification.${notification.channel}`,
    'notification',
    { notificationId, userId, type, channel, title, message },
    error,
    { attempts, retryHistory, eventId, metadata }
  );
}
```

---

## Architecture Flow

```
Event Producer
    ↓
[Create Event Envelope with Contract]
    ↓
[Validate Event Contract]
    ↓
[Publish to RabbitMQ with Proper Options]
    ↓
Event Consumer / Notification Service
    ↓
[Process Notification]
    ↓
    ├─ Success → Mark as SENT
    └─ Failure → Retry Strategy
                    ↓
                [Retry with Exponential Backoff]
                    ↓
                ├─ Success → Mark as SENT
                └─ All Retries Exhausted → DLQ
                                            ↓
                                        [Store in DLQ with Metadata]
                                            ↓
                                        [Emit DLQ Event for Monitoring]
```

---

## Testing

All implementations include comprehensive unit tests:

```bash
# Run tests for event contracts
npm test -- src/common/event-contracts.spec.ts

# Run tests for retry strategy
npm test -- src/notifications/retry-strategy.service.spec.ts

# Run tests for DLQ service
npm test -- src/notifications/dead-letter-queue.service.spec.ts
```

### Test Coverage:
- ✅ Event contract validation (valid/invalid cases)
- ✅ Event envelope creation with metadata
- ✅ Retry strategy success/failure scenarios
- ✅ Backoff calculation with jitter
- ✅ DLQ entry creation and retrieval
- ✅ DLQ status updates and retry operations
- ✅ DLQ statistics and cleanup

---

## Monitoring and Observability

### Events Emitted:

#### Retry Events:
- `notification.retry.started` - Retry attempt initiated
- `notification.retry.succeeded` - Operation succeeded after retry
- `notification.retry.attempt_failed` - Individual retry attempt failed
- `notification.retry.exhausted` - All retries exhausted

#### DLQ Events:
- `dlq.entry.created` - New entry added to DLQ
- `dlq.entry.status_changed` - Entry status updated
- `dlq.entry.retry` - DLQ entry being retried
- `dlq.entry.deleted` - Entry removed from DLQ
- `dlq.cleanup.completed` - Old entries cleaned up

### Recommended Monitoring:
1. Track `notification.retry.exhausted` rate
2. Monitor DLQ entry count by domain/eventType
3. Alert on DLQ entries older than 24 hours
4. Track retry success rate by notification type

---

## Database Migration

A new table `dead_letter_queue` needs to be created. Run the migration:

```sql
CREATE TABLE dead_letter_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(255) NOT NULL,
  domain VARCHAR(100) NOT NULL,
  original_payload JSONB NOT NULL,
  error JSONB NOT NULL,
  failure_context JSONB NOT NULL,
  metadata JSONB,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_dlq_status ON dead_letter_queue(status);
CREATE INDEX idx_dlq_domain ON dead_letter_queue(domain);
CREATE INDEX idx_dlq_event_type ON dead_letter_queue(event_type);
CREATE INDEX idx_dlq_created_at ON dead_letter_queue(created_at);
```

---

## Configuration

### Environment Variables:
```bash
# RabbitMQ
AMQP_URL=amqp://localhost:5672
RABBITMQ_URL=amqp://localhost:5672

# Retry Configuration (optional, uses defaults if not set)
NOTIFICATION_RETRY_MAX_RETRIES=3
NOTIFICATION_RETRY_INITIAL_DELAY_MS=1000
NOTIFICATION_RETRY_MAX_DELAY_MS=30000

# DLQ Configuration
DLQ_RETENTION_DAYS=30
```

---

## Benefits

1. **Repository Stability**: Consistent event contracts prevent payload mismatches
2. **Contributor Velocity**: Clear interfaces and validation reduce bugs
3. **Release Confidence**: Retry logic and DLQ provide fault tolerance
4. **Operational Visibility**: Comprehensive monitoring and tracing
5. **Type Safety**: Proper TypeScript types throughout the messaging layer
6. **Maintainability**: Modular services with clear responsibilities

---

## Future Enhancements

1. **DLQ Dashboard**: Admin UI for managing DLQ entries
2. **Retry Policies**: Dynamic configuration via admin panel
3. **Event Schema Registry**: Versioned event schemas with compatibility checks
4. **Circuit Breaker**: Prevent cascading failures in notification services
5. **Priority Queues**: Separate queues for high/low priority notifications

---

## Related Documentation

- [Event-Driven Architecture](../docs/EVENT_DRIVEN_ARCHITECTURE.md)
- [Notification System](../docs/notification.md)
- [Payment Processing](../docs/PAYMENT_PROCESSING.md)

---

## Summary

All 4 tasks have been successfully implemented with:
- ✅ Shared event contracts with validation
- ✅ Type-safe message publishing
- ✅ Bounded exponential backoff retry strategy
- ✅ Dead-letter queue with operational visibility
- ✅ Comprehensive test coverage
- ✅ Observability and monitoring hooks
- ✅ Documentation and migration scripts

The implementation improves system reliability, developer experience, and operational visibility while maintaining backward compatibility.
