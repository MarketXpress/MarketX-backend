# Regression Test Tracking Matrix — Issue #363

> **Theme:** F. Testing and Quality Gates  
> **Created:** 2026-04-27  
> **Scope:** All resolved backlog defects from `DEBUG_REPORT.md` (Security Hardening Implementation, April 25 2026)

---

## Summary

| # | Bug ID | Severity | Module / File | Root Cause | Regression Test File | Status |
|---|--------|----------|---------------|------------|----------------------|--------|
| 1 | BUG-01 | 🔴 Critical | `src/admin/admin-fraud.controller.ts` | MongoDB `$gte` syntax used inside TypeORM `.count()` | `src/admin/regression/regression-issue1-typeorm-query.spec.ts` | ✅ Covered |
| 2 | BUG-02 | 🔴 Critical | `src/admin/admin.module.ts` | `EventEmitterModule` and `AuditModule` missing from imports | `src/admin/regression/regression-issue2-module-deps.spec.ts` | ✅ Covered |
| 3 | BUG-03 | 🟡 Moderate | `src/fraud/fraud.service.ts` | `reviewAlert()` missing `eventEmitter.emit('fraud.alert_reviewed')` call | `src/fraud/regression/regression-issue3-review-alert-audit.spec.ts` | ✅ Covered |

---

## Detailed Fix ↔ Test Mapping

### BUG-01 · TypeORM Query Syntax Error

**File:** `src/admin/admin-fraud.controller.ts` (lines 197–204)  
**Fix summary:** Replaced `{ $gte: lastXHours }` (MongoDB syntax) with `new Date(Date.now() - N)` (plain TypeORM-compatible Date value) inside all three `repo.count()` calls in `getStats()`.

| Test case | What it guards |
|-----------|---------------|
| `getStats() resolves without throwing` | Top-level no-crash guard |
| `passes a plain Date (not a Mongo $gte object) to repo.count()` | Exact fix guard — fails if `$gte` syntax is re-introduced |
| `returns numeric counts for all three alert buckets` | Return shape correctness |
| `returns numeric counts for lockout buckets` | Return shape correctness |
| `reflects the count returned by the repository` | Correct forwarding of repo result |
| `handles repo.count() returning 0 gracefully` | Edge case: zero counts |
| `propagates a repository error` | Error handling path |

---

### BUG-02 · Missing Module Dependencies

**File:** `src/admin/admin.module.ts`  
**Fix summary:** Added `EventEmitterModule.forRoot()` and `AuditModule` to the `@Module({ imports: [] })` array so that `EventEmitter2` and `AuditService` can be injected into `AdminFraudController`.

| Test case | What it guards |
|-----------|---------------|
| `AdminFraudController resolves without DI errors` | DI wiring smoke test |
| `EventEmitter2 is resolvable within the admin module context` | EventEmitterModule import guard |
| `AuditService is resolvable within the admin module context` | AuditModule import guard |
| `review() emits a fraud.alert_reviewed event via the injected EventEmitter2` | End-to-end wiring: EventEmitter2 is functional |
| `getLockouts() calls AuditService.getAuditLogs()` | End-to-end wiring: AuditService is functional |

---

### BUG-03 · Missing Audit Event in reviewAlert()

**File:** `src/fraud/fraud.service.ts` (lines 248–280)  
**Fix summary:** Added `this.eventEmitter.emit('fraud.alert_reviewed', { … })` inside `reviewAlert()` with a full payload including `previousStatus`, `newStatus`, `reviewer`, `riskScore`, and the AuditActionType / AuditStatus enums.

Also covers the ⚠️ *Tests Missing* items from `DEBUG_REPORT.md`.

#### Core regression guards

| Test case | What it guards |
|-----------|---------------|
| `emits fraud.alert_reviewed when alert is reviewed` | The primary fix: event must be emitted |
| `does NOT silently swallow the event when reviewer is omitted` | Event emitted even without explicit reviewer |
| `payload contains correct userId (reviewer)` | Reviewer identity propagated |
| `falls back to "system" userId when reviewer absent` | Null-safety on reviewer field |
| `payload contains statePreviousValue and stateNewValue diff` | State diff correctness |
| `payload includes resourceType: "fraud_alert" and resourceId` | Resource identification |
| `payload includes actionType FRAUD_REVIEW` | Correct enum value |
| `payload status is SUCCESS` | Correct audit status |
| `metadata includes previousStatus, newStatus, riskScore, reviewer` | Full metadata payload |

#### Edge cases (previously ⚠️ untested)

| Test case | What it guards |
|-----------|---------------|
| `handles alert with null userId without throwing` | Null userId safety |
| `handles alert with missing metadata without throwing` | Undefined metadata safety |
| `handles reviewer as empty string — falls back to "system"` | Falsy string edge case |
| `returns null when alert is not found` | Not-found path |
| `does NOT emit the event when alert is not found` | No ghost events on missing alerts |
| `returns the updated alert after review` | Return value correctness |
| `persists the new status to the repository` | DB write verification |

#### Audit listener regression (previously ⚠️ untested)

| Test case | What it guards |
|-----------|---------------|
| `handleFraudAlertReviewed() calls auditService.logStateChange` | Listener wiring for reviewed events |
| `handleFraudAlertReviewed() does not throw when auditService fails` | Error handling path |
| `handleFraudAlertCreated() calls auditService with FRAUD_ALERT actionType` | Listener wiring for created events |
| `handleFraudAccountLocked() calls auditService with FRAUD_LOCKOUT actionType` | Listener wiring for lockout events |
| `handleFraudAlertCreated() does not throw when auditService fails` | Error handling path |

---

## Running the Regression Tests

```bash
# Run all three regression suites
npx jest --testPathPattern="regression/" --runInBand

# Run individual suites
npx jest src/admin/regression/regression-issue1-typeorm-query.spec.ts
npx jest src/admin/regression/regression-issue2-module-deps.spec.ts
npx jest src/fraud/regression/regression-issue3-review-alert-audit.spec.ts

# Run with coverage
npx jest --testPathPattern="regression/" --coverage --runInBand
```

---

## Files Changed

```
src/
├── admin/
│   └── regression/
│       ├── regression-issue1-typeorm-query.spec.ts   [NEW]
│       └── regression-issue2-module-deps.spec.ts     [NEW]
└── fraud/
    └── regression/
        └── regression-issue3-review-alert-audit.spec.ts  [NEW]

docs/
└── REGRESSION_TRACKING_MATRIX.md  [NEW]
```

---

## Done Criteria Checklist

- [x] Each resolved bug has ≥ 1 targeted regression test that would **fail** if the fix were reverted
- [x] All previously-flagged "Tests Missing" items from `DEBUG_REPORT.md` are now covered
- [x] No new regressions introduced (existing test suites unmodified)
- [x] Tracking matrix links every fix to its test cases
- [x] Tests are self-contained (no external DB, no network calls)