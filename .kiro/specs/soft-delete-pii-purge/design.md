# Design Document: Soft Delete & PII Purge

## Overview

This feature adds soft-delete support to the `User`, `Listing`, and `Order` entities, ensures active listing queries automatically exclude soft-deleted users, and introduces a daily cron job that anonymizes PII for users whose grace period has expired.

The primary goals are:
- Preserve referential integrity for financial records (orders, transactions, escrow disputes).
- Comply with data-retention policies by purging PII after 30 days.
- Keep the admin reporting dashboard functional regardless of user deletion state.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    HTTP Request Layer                    │
│  DELETE /users/:id  →  UsersService.softDeleteUser()    │
└────────────────────────────┬────────────────────────────┘
                             │
              ┌──────────────▼──────────────┐
              │        UsersService          │
              │  - softDeleteUser()          │
              │  - cascades to listings      │
              └──────────────┬──────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
   Users entity        Listings entity      Orders entity
  (deletedAt set)    (deletedAt set via    (deletedAt col,
                      cascade soft-delete)  no cascade)

              ┌──────────────────────────────┐
              │   PiiPurgeTask (Cron Daily)   │
              │  - finds users deleted >30d   │
              │  - overwrites PII columns     │
              │  - preserves financial data   │
              └──────────────────────────────┘
```

---

## Components and Interfaces

### 1. Entity Changes

**`src/users/users.entity.ts`**
- Add `@DeleteDateColumn() deletedAt?: Date`
- Add `status` column (mirrors `src/entities/user.entity.ts` pattern)
- Add `isActive` boolean column

**`src/listing/entities/listing.entity.ts`**
- Already has `@DeleteDateColumn()` — no change needed to the column itself.
- The `ManyToOne` relation to `Users` must use `withDeleted: false` awareness in queries.

**`src/orders/entities/order.entity.ts`**
- Add `@DeleteDateColumn() deletedAt?: Date`

### 2. UsersService — `softDeleteUser(id)`

```typescript
async softDeleteUser(userId: string): Promise<void>
```
- Calls `userRepository.softDelete(userId)` (sets `deletedAt`).
- Sets `status = DELETED`, `isActive = false`.
- Calls `listingRepository.softDelete({ userId })` to cascade.

### 3. ListingsService — Active Listings Query

The `findActiveListingsPaginated` query must join the `user` relation and filter `user.deletedAt IS NULL`. TypeORM's `withDeleted` option is NOT used here — we rely on the default soft-delete filter on the `Listing` side, plus an explicit join condition on the user.

### 4. PiiPurgeTask (new cron task)

**File:** `src/scheduler/pii-purge.task.ts`

```typescript
@Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
async handlePiiPurge(): Promise<void>
```

- Queries users where `deletedAt < NOW() - INTERVAL '30 days'` and PII is not yet anonymized (check `email` not starting with `deleted_`).
- For each eligible user, overwrites PII fields with anonymized values.
- Preserves `totalSales`, `sellerRating`, `totalReviews`, `id`, `createdAt`, financial FK references.

---

## Data Models

### Users entity additions

| Column | Type | Change |
|---|---|---|
| `deletedAt` | `timestamp \| null` | ADD via `@DeleteDateColumn` |
| `status` | `enum` | ADD (ACTIVE / DELETED) |
| `isActive` | `boolean` | ADD, default `true` |

### Orders entity addition

| Column | Type | Change |
|---|---|---|
| `deletedAt` | `timestamp \| null` | ADD via `@DeleteDateColumn` |

### Anonymization mapping

| PII Field | Anonymized Value |
|---|---|
| `email` | `deleted_<id>@anonymized.local` |
| `name` | `Deleted User` |
| `bio` | `null` |
| `avatarUrl` | `null` |
| `password` | random bcrypt hash |
| `refreshToken` | `null` |

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

**Property 1: Soft-delete excludes user from standard queries**
*For any* user that has been soft-deleted, querying the user repository with default options should not return that user.
**Validates: Requirements 1.2**

**Property 2: Soft-delete cascades to listings**
*For any* user with N active listings, after soft-deleting the user, querying listings with default options should return zero listings for that userId.
**Validates: Requirements 1.3**

**Property 3: Active listings exclude soft-deleted user listings**
*For any* active listing query, all returned listings should have an owning user whose `deletedAt` is null.
**Validates: Requirements 2.1**

**Property 4: Orders survive user soft-delete**
*For any* order, after soft-deleting the buyer or seller user, the order record should still be retrievable with `withDeleted: true` or via direct ID lookup.
**Validates: Requirements 3.1**

**Property 5: PII purge anonymizes all PII fields**
*For any* user whose `deletedAt` is older than 30 days, after the purge runs, none of the PII fields (`email`, `name`, `bio`, `avatarUrl`, `refreshToken`) should contain the original values.
**Validates: Requirements 4.1**

**Property 6: PII purge preserves financial aggregates**
*For any* user processed by the purge, the values of `totalSales`, `sellerRating`, and `totalReviews` should be identical before and after the purge.
**Validates: Requirements 4.2**

---

## Error Handling

- `softDeleteUser` throws `NotFoundException` if the user does not exist.
- `softDeleteUser` is idempotent: calling it on an already-deleted user is a no-op (TypeORM `softDelete` handles this gracefully).
- The PII purge cron catches all errors per-user and logs them without aborting the entire batch.
- Auth guard checks `isActive` and `status !== DELETED` and returns `401 Unauthorized` for deleted users.

---

## Testing Strategy

### Unit Tests
- `UsersService.softDeleteUser` — verify `softDelete` is called on user and listings repos.
- `ListingsService.findActiveListingsPaginated` — verify the query builder joins user and filters `deletedAt IS NULL`.
- `PiiPurgeTask.handlePiiPurge` — verify correct users are selected and PII fields are overwritten.

### Property-Based Tests (fast-check)

The project uses Jest. We will add `fast-check` for property-based testing.

Each property test runs a minimum of 100 iterations.

- **Property 1** — generate random user IDs, soft-delete, assert not found in default query.
- **Property 2** — generate users with random listing counts, soft-delete user, assert listing count = 0.
- **Property 3** — generate mixed listing sets (some with deleted owners), assert active query returns only non-deleted-owner listings.
- **Property 4** — generate orders with random buyer/seller IDs, soft-delete users, assert orders still retrievable.
- **Property 5 & 6** — generate users with random PII and financial data, run purge logic, assert PII cleared and financials unchanged.

Tag format: `**Feature: soft-delete-pii-purge, Property {N}: {text}**`
