# Requirements Document

## Introduction

Users must be able to delete their accounts without destroying financial history or breaking referential integrity for past transactions and escrow disputes. This feature introduces soft-delete support across the User, Listing, and Order entities, automatic filtering of active listings tied to soft-deleted users, and a background cron job that purges PII after a 30-day grace period while preserving anonymized financial metrics.

## Glossary

- **Soft Delete**: Marking a record as deleted by setting a `deletedAt` timestamp instead of removing the row from the database.
- **Hard Delete / Purge**: Physically removing a row or overwriting PII columns with anonymized placeholders.
- **PII (Personally Identifiable Information)**: Data that can identify a specific individual — e.g., email, name, phone number, avatar URL.
- **Grace Period**: A 30-day window after soft-deletion during which the account can be recovered and PII still exists.
- **Anonymization**: Replacing PII fields with non-identifying placeholder values while retaining financial aggregates.
- **Active Listing**: A listing where `isActive = true`, `deletedAt IS NULL`, and the owning user has not been soft-deleted.
- **DeleteDateColumn**: TypeORM decorator that adds a `deletedAt` nullable timestamp column and enables automatic soft-delete filtering.
- **Cron Job**: A scheduled background task that runs at a defined interval.
- **Admin Reporting Dashboard**: The admin-facing interface that reads order and transaction data for financial reporting.

## Requirements

### Requirement 1

**User Story:** As a user, I want to delete my account, so that my personal data is removed from the platform while past financial records remain intact.

#### Acceptance Criteria

1. WHEN a user requests account deletion, THE System SHALL set the `deletedAt` timestamp on the User record and set `status` to `DELETED` without removing the row.
2. WHEN a User record has a non-null `deletedAt`, THE System SHALL exclude that user from all standard queries that use TypeORM's default repository methods.
3. WHEN a User record is soft-deleted, THE System SHALL also soft-delete all Listing records owned by that user in the same operation.
4. IF a user attempts to log in after soft-deletion, THEN THE System SHALL reject the authentication request with an appropriate error.

---

### Requirement 2

**User Story:** As a marketplace buyer, I want the active listings feed to only show listings from active sellers, so that I do not interact with listings from deleted accounts.

#### Acceptance Criteria

1. WHEN the System fetches Active Listings, THE System SHALL exclude any listing whose owning user has a non-null `deletedAt`.
2. WHEN a Listing record has a non-null `deletedAt`, THE System SHALL exclude that listing from all Active Listing queries automatically via TypeORM's soft-delete filter.
3. WHILE a user's `deletedAt` is non-null, THE System SHALL return zero active listings for that user when queried by seller ID.

---

### Requirement 3

**User Story:** As a platform operator, I want Order records to survive user deletion, so that the admin reporting dashboard always has complete financial history.

#### Acceptance Criteria

1. WHEN a User record is soft-deleted, THE System SHALL retain all associated Order records with their financial data intact.
2. WHEN the admin reporting dashboard queries orders, THE System SHALL return order records regardless of whether the associated buyer or seller has been soft-deleted.
3. THE Order entity SHALL include a `deletedAt` column decorated with `@DeleteDateColumn` to support future order-level soft-delete without breaking existing queries.

---

### Requirement 4

**User Story:** As a data-privacy officer, I want PII to be permanently removed after a 30-day grace period, so that the platform complies with data-retention policies.

#### Acceptance Criteria

1. WHEN a User record's `deletedAt` is older than 30 days, THE System SHALL overwrite PII fields (`email`, `firstName`, `lastName`, `phoneNumber`, `avatarUrl`, `bio`, `stellarWalletAddress`, `refreshToken`) with anonymized placeholder values.
2. WHEN the PII purge runs, THE System SHALL preserve financial aggregate columns (`totalSales`, `sellerRating`, `totalReviews`) on the anonymized user row.
3. THE System SHALL execute the PII purge cron job once per day.
4. WHEN the PII purge processes a user, THE System SHALL set the user's `status` to `DELETED` and `isActive` to `false` if not already set.
5. IF no users are eligible for purge during a cron run, THEN THE System SHALL log that no users required purging and exit without error.
