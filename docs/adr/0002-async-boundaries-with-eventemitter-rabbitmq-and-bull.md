# ADR 0002: Standardize async boundaries with EventEmitter2, RabbitMQ, and Bull

- Status: Accepted
- Date: 2026-04-24
- Deciders: MarketX maintainers
- Technical Story: #371 Introduce architecture decision records

## Context

MarketX has multiple kinds of asynchronous work:

- same-process side effects such as notifications and audit handlers
- integration-facing event broadcast for downstream consumers
- retryable or scheduled jobs such as email, image processing, and recommendation refreshes

These flows were previously documented in several places, but the decision itself was implicit. Without a written standard, contributors can easily choose the wrong transport, hardcode event names, or mix synchronous business writes with retry-oriented background work.

## Decision

MarketX uses three async layers with distinct responsibilities:

- `@nestjs/event-emitter` handles in-process domain events and same-process fan-out between modules.
- RabbitMQ publishes durable domain-event envelopes for external consumers and future service boundaries.
- Bull with Redis handles retryable, delayed, or long-running background jobs.

Contributor rules:

- Domain modules should complete the primary state transition first, then emit a typed event using the canonical `EventNames` registry.
- In-process listeners should handle same-process side effects that belong in the current deployment unit.
- The messaging layer should bridge canonical in-process events into RabbitMQ envelopes instead of letting each feature publish arbitrary broker payloads.
- Background work that requires retries, scheduling, or queue visibility should go through Bull queues registered in the shared queue constants and jobs module.
- New async flows should document which layer they use and why.

## Consequences

### Positive

- Side effects stay decoupled from primary request handling.
- Contributors have a consistent rule for choosing between direct calls, events, brokered messages, and queues.
- External integrations can consume durable event envelopes without reaching into internal module implementation details.

### Negative

- The system carries more moving parts than a purely synchronous design.
- Event naming and contract drift can still cause failures if constants and shared contracts are not used consistently.
- Debugging can span controllers, listeners, queues, and broker publish paths.

## Validation and follow-up

- Keep event names centralized in `src/common/events.ts`.
- Add or update tests when new queues, listeners, or event contracts are introduced.
- Update the relevant architecture docs and this ADR whenever the async boundary rules change.

## References

- [`docs/EVENT_ARCHITECTURE.md`](../EVENT_ARCHITECTURE.md)
- [`docs/EVENT_DRIVEN_ARCHITECTURE.md`](../EVENT_DRIVEN_ARCHITECTURE.md)
- [`docs/NOTIFICATIONS_MESSAGING_BG_JOBS.md`](../NOTIFICATIONS_MESSAGING_BG_JOBS.md)
- [`src/common/events.ts`](../../src/common/events.ts)
- [`src/job-processing/queue.constants.ts`](../../src/job-processing/queue.constants.ts)
- [`src/messaging/rabbitmq.module.ts`](../../src/messaging/rabbitmq.module.ts)
