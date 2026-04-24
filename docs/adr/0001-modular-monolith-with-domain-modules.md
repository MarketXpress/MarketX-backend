# ADR 0001: Use a modular monolith with explicit NestJS domain modules

- Status: Accepted
- Date: 2026-04-24
- Deciders: MarketX maintainers
- Technical Story: #371 Introduce architecture decision records

## Context

MarketX already operates as a single NestJS application that imports a large set of domain and infrastructure modules through `AppModule`. Contributors need a stable mental model for where new behavior belongs, how shared capabilities should be exposed, and when a feature should stay in-process versus becoming a separate service.

Without a written decision, the repository invites accidental coupling in `common/`, one-off cross-module shortcuts, or premature microservice splits that would make local development and release coordination harder.

## Decision

MarketX will remain a modular monolith by default.

- Domain capabilities should live in explicit NestJS feature modules such as `orders`, `payments`, `notifications`, `refunds`, `products`, and `auth`.
- Cross-cutting platform capabilities should live in shared infrastructure modules such as `common`, `health`, `messaging`, `job-processing`, `redis-caching`, and `backup`.
- New features should extend an existing module when they belong to that bounded context; otherwise they should introduce a new module with clear ownership instead of spreading behavior across unrelated folders.
- Cross-module behavior should flow through explicit service interfaces, events, queues, or shared contracts rather than hidden imports and duplicated logic.
- We should not split modules into separately deployed services unless there is a concrete operational requirement such as isolation, scaling pressure, ownership separation, or external integration boundaries that the modular monolith can no longer handle cleanly.

## Consequences

### Positive

- Local development stays simple because contributors can run one API process against the local infrastructure profile.
- Shared transactions, validation rules, and typed contracts remain easier to coordinate across tightly related marketplace domains.
- Module ownership is easier to reason about when new code starts from a clear feature boundary.

### Negative

- The application can accumulate coupling if maintainers allow too much logic to drift into shared modules.
- Build, startup, and review scope can grow as the monolith grows.
- Strong boundaries still require discipline because deployment boundaries will not enforce them for us.

## Validation and follow-up

- Keep `AppModule` imports and module-level docs aligned with the actual feature boundaries.
- Prefer architectural reviews when a change adds a new top-level module or introduces a new cross-module dependency path.
- If a future change proposes extracting a service, capture that move in a successor ADR instead of making the boundary change implicitly.

## References

- [`src/app.module.ts`](../../src/app.module.ts)
- [`README.md`](../../README.md)
