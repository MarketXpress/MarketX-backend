# ADR 0005: Treat payment confirmation as the gate for order payment progression

- Status: Accepted
- Date: 2026-04-24
- Deciders: MarketX maintainers
- Technical Story: #371 Introduce architecture decision records

## Context

MarketX handles marketplace payments through explicit payment records, monitoring, verification, timeout handling, and downstream order updates. Contributors touching orders, payments, escrow, or webhooks need a stable rule for how payment state affects order state and where payment verification logic belongs.

If this stays implicit, it becomes easy to collapse payment and order state together, update orders before payment verification is complete, or bypass timeout and audit behavior in one-off integrations.

## Decision

Payment confirmation is the gate that advances order payment progression.

- Creating an order and initiating a payment are distinct steps with separate state.
- Payments should be represented as first-class records tied to an order and tracked through pending, confirmed, failed, timeout, or refunded states.
- Verification logic belongs in the payment flow, including stream monitoring, webhook handling, or explicit verification endpoints.
- Orders should only move into paid payment states after the payment module confirms the payment against the expected amount, currency, and destination.
- Timeout, failure, and refund handling should update payment state explicitly instead of inferring success from incomplete external signals.

## Consequences

### Positive

- Payment workflows remain auditable and easier to debug than direct order-status mutation.
- Order lifecycle logic can rely on a verified payment boundary instead of scattered integration callbacks.
- Future escrow and reconciliation work has a cleaner foundation because payment state remains explicit.

### Negative

- The model is more complex than a single status flag on orders.
- Contributors must coordinate changes across payment, order, and notification paths when payment lifecycle behavior changes.
- Integrations must tolerate eventual consistency between payment confirmation and downstream side effects.

## Validation and follow-up

- Preserve regression coverage for payment verification, timeout handling, and order updates whenever these flows change.
- Document any new payment method or escrow integration that changes the confirmation boundary.
- Add a successor ADR if escrow release or multi-provider payment orchestration becomes the dominant architectural boundary.

## References

- [`docs/PAYMENT_PROCESSING.md`](../PAYMENT_PROCESSING.md)
- [`docs/database-schema.md`](../database-schema.md)
- [`src/payments`](../../src/payments)
- [`src/orders`](../../src/orders)
