# ADR 0004: Persist notifications first, then deliver them with retries and DLQ handling

- Status: Accepted
- Date: 2026-04-24
- Deciders: MarketX maintainers
- Technical Story: #371 Introduce architecture decision records

## Context

Notifications in MarketX span multiple channels and side effects, including in-app persistence, WebSocket delivery, email, push attempts, retries, and dead-letter handling. When notification architecture lives only in implementation docs, contributors can miss the core expectation that delivery reliability and operational visibility matter as much as feature completeness.

If this remains implicit, new notification paths may bypass persistence, skip retry policies, or fail without observable recovery tooling.

## Decision

Notification workflows must persist notification intent before attempting channel delivery, and outbound delivery must use bounded retry and dead-letter handling when appropriate.

- Notification creation should produce a durable record that can be inspected, retried, and audited.
- Real-time and outbound delivery should be treated as side effects of that durable record, not as the sole representation of whether a notification exists.
- Retry behavior should use structured policies with bounded backoff rather than ad hoc loops.
- Exhausted failures should be routed to DLQ handling so operators can inspect, retry, or close them explicitly.
- Notification lifecycle events should remain observable for monitoring and debugging.

## Consequences

### Positive

- Users and operators have a durable record of intended notifications even when delivery fails.
- Transient delivery failures can recover automatically without losing observability.
- Contributors extending notification channels inherit a clear reliability model instead of inventing one per channel.

### Negative

- Notification code paths are more complex than direct fire-and-forget delivery.
- Persistent records, retry logic, and DLQ state introduce additional storage and operational surfaces.
- Contributors must think about idempotency and lifecycle events when adding new delivery behavior.

## Validation and follow-up

- Add tests when new channels, retry policies, or DLQ transitions are introduced.
- Keep health, monitoring, and operational docs aligned with delivery behavior.
- Update this ADR if the project changes the persistence-first rule or adopts a different failure-handling model.

## References

- [`docs/NOTIFICATIONS_MESSAGING_BG_JOBS.md`](../NOTIFICATIONS_MESSAGING_BG_JOBS.md)
- [`src/notifications/notifications.service.ts`](../../src/notifications/notifications.service.ts)
- [`src/notifications/retry-strategy.service.ts`](../../src/notifications/retry-strategy.service.ts)
- [`src/notifications/dead-letter-queue.service.ts`](../../src/notifications/dead-letter-queue.service.ts)
