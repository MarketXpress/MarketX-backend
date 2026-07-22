# ADR 0003: Use PostgreSQL as the system of record with Redis and RabbitMQ as supporting infrastructure

- Status: Accepted
- Date: 2026-04-24
- Deciders: MarketX maintainers
- Technical Story: #371 Introduce architecture decision records

## Context

MarketX needs dependable transactional storage for marketplace entities, fast local development, cache and queue support, and a broker for domain-event distribution. These choices appear in code and setup docs today, but contributors do not have a single place that states which systems are authoritative and which are supporting infrastructure.

That distinction matters because bugs and migrations should be reasoned about differently for system-of-record data, cached data, queued work, and published events.

## Decision

MarketX standardizes on the following infrastructure roles:

- PostgreSQL is the system of record for marketplace state and transactional workflows.
- TypeORM is the primary ORM and entity mapping layer for persisted application data.
- Redis is supporting infrastructure for caching, throttling support, and Bull-backed job queues.
- RabbitMQ is supporting infrastructure for durable event broadcast and integration-facing fan-out.
- The default contributor workflow should target the repository's local compose profile for PostgreSQL, Redis, and RabbitMQ while running the API process locally.

Contributor rules:

- Persist authoritative business state in PostgreSQL-backed entities first.
- Treat Redis state as reconstructable or operational, not as the source of truth for marketplace records.
- Treat RabbitMQ messages as delivery artifacts of domain events, not as the primary record of completed business actions.
- Document migrations, rollbacks, and operational assumptions whenever a change alters persisted data or infrastructure expectations.

## Consequences

### Positive

- Contributors get a clear separation between durable business data and operational infrastructure.
- Local development mirrors the production dependency shape closely enough to catch integration issues early.
- Data ownership becomes easier to reason about across orders, payments, notifications, and other core domains.

### Negative

- Operational complexity is higher than a single-database setup.
- Developers must understand the failure modes of three backing systems instead of one.
- Infrastructure-dependent tests may require more setup and slower feedback loops than pure unit tests.

## Validation and follow-up

- Keep setup docs aligned with the actual environment variables and compose profile.
- Require migration notes when PostgreSQL-backed entities or schema assumptions change.
- Revisit this ADR if the project adopts a second primary datastore or retires TypeORM.

## References

- [`src/app.module.ts`](../../src/app.module.ts)
- [`docs/database-schema.md`](../database-schema.md)
- [`docs/local-infra.md`](../local-infra.md)
- [`README.md`](../../README.md)
