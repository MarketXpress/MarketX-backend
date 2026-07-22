# Architecture Decision Records

This directory stores Architecture Decision Records (ADRs) for MarketX.

ADRs capture architectural decisions that should remain easy to find long after the related pull request, issue, or chat thread is gone. They are especially useful when a choice affects multiple modules, changes contributor workflow, or introduces constraints that future work must respect.

## When to add or update an ADR

Create or update an ADR when a change:

- defines or changes module boundaries
- changes async data flow, messaging, or background job behavior
- introduces or retires major infrastructure dependencies
- changes persistence, consistency, or rollback expectations
- establishes a long-lived domain workflow that future contributors must preserve

Small implementation details do not need ADRs. Stable architectural constraints do.

## Naming and status

- Store new ADRs as `NNNN-short-title.md`
- Keep numbering sequential and never reuse retired numbers
- Start from the template in [template.md](./template.md)

Supported statuses:

- `Proposed`
- `Accepted`
- `Superseded`
- `Deprecated`

If a decision changes, create a new ADR and update the older one to point to the replacement instead of rewriting history.

## Authoring checklist

Each ADR should answer:

- What problem or recurring ambiguity are we resolving?
- What decision did we make?
- What tradeoffs did we accept?
- How should contributors validate or preserve this decision?
- Which code paths or docs provide the current implementation context?

## ADR Index

- [0001: Use a modular monolith with explicit NestJS domain modules](./0001-modular-monolith-with-domain-modules.md)
- [0002: Standardize async boundaries with EventEmitter2, RabbitMQ, and Bull](./0002-async-boundaries-with-eventemitter-rabbitmq-and-bull.md)
- [0003: Use PostgreSQL as the system of record with Redis and RabbitMQ as supporting infrastructure](./0003-postgresql-system-of-record-with-redis-and-rabbitmq.md)
- [0004: Persist notifications first, then deliver them with retries and DLQ handling](./0004-persist-notifications-with-retry-and-dlq.md)
- [0005: Treat payment confirmation as the gate for order payment progression](./0005-payment-confirmation-drives-order-progression.md)

## Working agreement

When a pull request changes one of the decisions above, update the affected ADR or add a successor ADR in the same change. This keeps architecture context in the repository rather than in reviewer memory.
