# Implementation Plan

- [x] 1. Add @DeleteDateColumn to Users and Orders entities
  - Add `deletedAt`, `status`, and `isActive` to `src/users/users.entity.ts`
  - Add `deletedAt` to `src/orders/entities/order.entity.ts`
  - _Requirements: 1.1, 1.2, 3.3_

- [ ] 2. Implement softDeleteUser in UsersService
  - [ ] 2.1 Add softDeleteUser method to UsersService
    - Soft-delete the user row and cascade soft-delete to all owned listings
    - Set `status = DELETED` and `isActive = false`
    - _Requirements: 1.1, 1.3_
  - [ ]* 2.2 Write property test: soft-delete excludes user from standard queries (Property 1)
    - **Feature: soft-delete-pii-purge, Property 1: Soft-delete excludes user from standard queries**
    - **Validates: Requirements 1.2**
  - [ ]* 2.3 Write property test: soft-delete cascades to listings (Property 2)
    - **Feature: soft-delete-pii-purge, Property 2: Soft-delete cascades to listings**
    - **Validates: Requirements 1.3**

- [ ] 3. Fix active listings query to filter soft-deleted user listings
  - [ ] 3.1 Update findActiveListingsPaginated to join user and filter deletedAt IS NULL
    - Add `.leftJoinAndSelect('listing.user', 'user')` and `.andWhere('user.deletedAt IS NULL')`
    - _Requirements: 2.1, 2.2_
  - [ ]* 3.2 Write property test: active listings exclude soft-deleted user listings (Property 3)
    - **Feature: soft-delete-pii-purge, Property 3: Active listings exclude soft-deleted user listings**
    - **Validates: Requirements 2.1**

- [ ] 4. Ensure orders survive user soft-delete
  - [ ] 4.1 Verify Order entity has DeleteDateColumn and relations use withDeleted-safe patterns
    - Confirm admin order queries do not filter by user deletedAt
    - _Requirements: 3.1, 3.2, 3.3_
  - [ ]* 4.2 Write property test: orders survive user soft-delete (Property 4)
    - **Feature: soft-delete-pii-purge, Property 4: Orders survive user soft-delete**
    - **Validates: Requirements 3.1**

- [ ] 5. Checkpoint — Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Implement PII purge cron job
  - [ ] 6.1 Create PiiPurgeTask in src/scheduler/pii-purge.task.ts
    - Query users where deletedAt < NOW() - 30 days and not yet anonymized
    - Overwrite PII fields with anonymized placeholders
    - Preserve totalSales, sellerRating, totalReviews
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
  - [ ] 6.2 Register PiiPurgeTask in SchedulerModule
    - Add Users entity to TypeOrmModule.forFeature in SchedulerModule
    - _Requirements: 4.3_
  - [ ]* 6.3 Write property test: PII purge anonymizes all PII fields (Property 5)
    - **Feature: soft-delete-pii-purge, Property 5: PII purge anonymizes all PII fields**
    - **Validates: Requirements 4.1**
  - [ ]* 6.4 Write property test: PII purge preserves financial aggregates (Property 6)
    - **Feature: soft-delete-pii-purge, Property 6: PII purge preserves financial aggregates**
    - **Validates: Requirements 4.2**

- [ ] 7. Final Checkpoint — Ensure all tests pass, ask the user if questions arise.
