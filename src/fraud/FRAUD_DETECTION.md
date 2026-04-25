# Fraud Detection System

## Overview

The Fraud Detection System is a comprehensive fraud prevention service that monitors suspicious activity, flags risky transactions, and implements automated protection measures. It combines multiple detection rules to calculate a risk score and automatically takes protective actions with **complete audit trail logging** for compliance and security review.

## Features

- **Velocity Monitoring**: Detects rapid-fire requests from the same user
- **Duplicate Order Detection**: Identifies repeated order attempts
- **IP/Device Fingerprinting**: Tracks and flags suspicious device reuse patterns
- **Risk Scoring**: Weighted aggregation of multiple fraud signals (0-100)
- **Automatic Suspension**: Auto-blocks high-risk requests (score ≥ 75)
- **Account Lockout Protocol**: Automated lockout after 3 fraud flags within 60 minutes
- **Admin Review Queue**: Manual review interface for flagged transactions
- **Complete Audit Trail**: Immutable audit logs for all fraud actions and lockouts
- **Admin Visibility Dashboard**: Comprehensive stats, lockout tracking, and audit trail endpoints
- **Request Monitoring**: Global middleware that analyzes all requests

## Architecture

### Core Components

#### 1. **FraudAlert Entity** (`entities/fraud-alert.entity.ts`)
Stores fraud detection records with:
- Risk score (0-100)
- User, order, IP, and device fingerprint tracking
- Status: `pending`, `reviewed`, `suspended`, `safe`, `manual_review`
- Metadata for additional context
- **Lockout tracking**: `lockoutReason`, `lockoutTimestamp`, `lockoutDurationMinutes`
- **Review tracking**: `reviewedBy`, `reviewedAt`, `reviewNotes`

#### 2. **Detection Rules** (`rules/`)

##### Velocity Rule (`velocity.rule.ts`)
- Monitors requests per minute for each user
- **Threshold**: >20 requests/min
- **Score Impact**: Up to 50 points (linear scaling)

##### Duplicate Order Rule (`duplicate-order.rule.ts`)
- Detects repeated order attempts within 5-minute window
- **Score Impact**: 40 points on duplicate

##### IP/Fingerprint Rule (`ip-fingerprint.rule.ts`)
- Tracks blacklisted IPs
- Detects device fingerprint reuse across multiple IPs
- **Score Impact**: 40 points (blacklist) + 30 points (multi-IP)

#### 3. **Risk Scoring** (`score.ts`)
Aggregates rules with weighted combination (conservative tuning):
- Velocity: 40% weight
- Duplicate Order: 35% weight  
- IP/Fingerprint: 25% weight
- **Final Score**: 0-100 (capped)

#### 4. **FraudService** (`fraud.service.ts`)
Main business logic:
- `analyzeRequest()`: Evaluates request, creates alert if score ≥ 20
- `getAlerts()`: Paginated alert retrieval
- `reviewAlert()`: Admin action to update alert status
- **Audit Integration**: Emits events for all fraud actions (alerts, lockouts, reviews)

#### 5. **RequestMonitorMiddleware** (`middleware/request-monitor.middleware.ts`)
Global middleware applied to all requests:
- Extracts user ID, IP, device fingerprint from request headers
- Calls `analyzeRequest()`
- Auto-blocks requests with score ≥ 90

#### 6. **Admin Controllers** (`../admin/admin-fraud.controller.ts`)
HTTP endpoints for admin dashboard:
- `GET /admin/fraud/alerts` - List all alerts (paginated, filterable)
- `GET /admin/fraud/alerts/:id` - Get single alert details
- `PATCH /admin/fraud/alerts/:id/review` - Update alert status with audit logging
- `GET /admin/fraud/alerts/:id/audit-trail` - Complete audit trail for an alert
- `GET /admin/fraud/lockouts` - List all account lockouts (paginated)
- `GET /admin/fraud/stats` - Fraud statistics (24h, 7d, 30d)

#### 7. **Public Controller** (`fraud.controller.ts`)
Public endpoints:
- `GET /fraud/alerts` - Paginated alert list (public)

### Audit Trail Integration

The fraud system integrates with the central audit logging system via event emission:

#### Audit Action Types
- `FRAUD_ALERT`: Created when a fraud alert is generated
- `FRAUD_LOCKOUT`: Created when an account is automatically locked
- `FRAUD_REVIEW`: Created when an admin reviews a fraud alert

#### Events Emitted
1. **`fraud.alert_created`**: Emitted when a new fraud alert is created
   - Includes: userId, riskScore, triggeredRules, ipAddress, deviceId
   - Logged to audit system with full state tracking

2. **`fraud.account_locked`**: Emitted when automated lockout is triggered
   - Includes: userId, fraudAlertId, flagCount, riskScore, lockoutReason
   - Previous and new user status tracked in audit log

3. **`fraud.alert_reviewed`**: Emitted when admin reviews an alert
   - Includes: reviewer ID, previous status, new status, review notes
   - Full state diff recorded for compliance

#### Audit Listener
The `AuditEventListener` (`src/audit/audit.listener.ts`) handles all fraud events:
- `handleFraudAlertCreated()`: Logs alert creation
- `handleFraudAccountLocked()`: Logs account lockout
- `handleFraudAlertReviewed()`: Logs admin review actions

## Database Schema

```sql
CREATE TABLE fraud_alerts (
  id UUID PRIMARY KEY,
  userId VARCHAR NULL,
  orderId VARCHAR NULL,
  ip VARCHAR NULL,
  deviceFingerprint VARCHAR NULL,
  riskScore DOUBLE PRECISION NOT NULL,
  reason TEXT NULL,
  status VARCHAR(32) DEFAULT 'pending',
  metadata JSON NULL,
  lockoutReason TEXT NULL,
  lockoutTimestamp TIMESTAMP NULL,
  lockoutDurationMinutes INT NULL,
  reviewedBy VARCHAR NULL,
  reviewedAt TIMESTAMP NULL,
  reviewNotes TEXT NULL,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW()
);
```

**Migration**: `src/migrations/1680000000000-CreateFraudAlerts.ts`

**Note**: After deploying these changes, run a database migration to add the new columns for lockout and review tracking.

## Thresholds and Tuning

### Alert Creation Threshold
- **Score ≥ 20**: Alert is created and stored for review
- Adjustable in `FraudService.analyzeRequest()`

### Auto-Suspension Threshold
- **Score ≥ 70**: Request is **blocked** with 403 Forbidden
- Adjustable in `RequestMonitorMiddleware.use()`

### False Positive Mitigation
- Conservative rule weights reduce false positives
- Velocity threshold set at >20 req/min (common user = 0-10/min)
- Duplicate detection only within 5-minute window
- Multi-IP fingerprint requires 3+ IPs in reuse history

## Integration

### Module Setup
The fraud detection system is integrated into the application via:

1. **FraudModule** - Provides service, controllers, entity
2. **RequestMonitorMiddleware** - Applied globally in `AppModule`
3. **AdminModule** - Exports admin fraud controller
4. **AppDataSource** - Includes `FraudAlert` entity for TypeORM

### Configuration via Environment Variables
```bash
# Optional: Customize Redis connection for rule state storage
REDIS_URL=redis://localhost:6379
```

## Usage

### For Admin: Review Flagged Transactions

```bash
# Get all alerts with pagination
curl "http://localhost:3000/admin/fraud/alerts?page=1&limit=50"

# Filter by status
curl "http://localhost:3000/admin/fraud/alerts?status=pending"

# Filter by user
curl "http://localhost:3000/admin/fraud/alerts?userId=user-123"

# Response:
{
  "data": [
    {
      "id": "uuid-1",
      "userId": "user-123",
      "riskScore": 65,
      "status": "pending",
      "reason": "velocity:25/min;duplicate:repeat-order",
      "createdAt": "2026-02-19T20:30:00Z",
      "updatedAt": "2026-02-19T20:30:00Z"
    }
  ],
  "meta": {
    "total": 42,
    "page": 1,
    "limit": 50,
    "totalPages": 1
  }
}

# Get single alert details
curl http://localhost:3000/admin/fraud/alerts/uuid-1

# Mark as reviewed with notes
curl -X PATCH http://localhost:3000/admin/fraud/alerts/uuid-1/review \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin-token>" \
  -d '{"mark": "safe", "notes": "Reviewed and cleared - false positive"}'

# Response: Updated alert with status="safe", reviewedBy, reviewedAt, reviewNotes

# Get complete audit trail for an alert
curl http://localhost:3000/admin/fraud/alerts/uuid-1/audit-trail

# Response:
{
  "alert": {...},
  "auditTrail": {
    "alertEvents": [...],
    "lockoutEvents": [...],
    "total": 3
  }
}

# View all account lockouts
curl "http://localhost:3000/admin/fraud/lockouts?page=1&limit=50"

# Filter lockouts by user
curl "http://localhost:3000/admin/fraud/lockouts?userId=user-123"

# Get fraud statistics
curl http://localhost:3000/admin/fraud/stats

# Response:
{
  "alerts": {
    "last24Hours": 15,
    "last7Days": 87,
    "last30Days": 342
  },
  "lockouts": {
    "last24Hours": 3,
    "last7Days": 12
  }
}
```

### For Users: View Alerts (Read-Only)

```bash
# List alerts with pagination
curl "http://localhost:3000/fraud/alerts?page=1&pageSize=25"

# Response:
{
  "items": [...],
  "total": 42,
  "page": 1,
  "pageSize": 25
}
```

### Audit Trail Queries

Admins can query the audit system directly for fraud-related events:

```bash
# Get all fraud alerts from audit logs
curl "http://localhost:3000/admin/audit?action=FRAUD_ALERT&page=1&limit=100"

# Get all lockout events
curl "http://localhost:3000/admin/audit?action=FRAUD_LOCKOUT&page=1&limit=50"

# Get fraud reviews by specific admin
curl "http://localhost:3000/admin/audit?action=FRAUD_REVIEW&userId=admin-123"

# Get fraud events in date range
curl "http://localhost:3000/admin/audit?action=FRAUD_ALERT&startDate=2026-04-01&endDate=2026-04-25"
```

## Testing

### Run Fraud Tests
```bash
npm run test -- src/fraud/tests/fraud.service.spec.ts
```

### Test Coverage
- `evaluateVelocity`: Validates request frequency detection
- `evaluateDuplicateOrder`: Confirms duplicate detection logic
- `evaluateIpFingerprint`: Tests IP/fingerprint tracking
- `FraudService.analyzeRequest`: Checks alert creation and scoring

## Performance Considerations

1. **In-Memory Rule State**: Velocity and duplicate rules use in-memory Maps
   - Auto-cleanup: Entries expire after window period (1-5 min)
   - Suitable for single-instance or closely-coupled deployments
   - **For distributed systems**: Migrate to Redis-backed state

2. **Middleware Overhead**: ~1-5ms per request
   - Evaluates 3 rules in parallel
   - Fail-open on Redis unavailability

3. **Database I/O**: Alert creation is asynchronous
   - Non-blocking for request flow
   - Alerting lag: ~50-100ms

## Customization

### Adjusting Rule Weights
Edit `src/fraud/score.ts`:
```typescript
const weights = [0.4, 0.35, 0.25];  // [velocity, duplicate, ip/fp]
```

### Changing Alert Thresholds
Edit `src/fraud/fraud.service.ts`:
```typescript
if (result.riskScore >= 20) { /* create alert */ }        // Alert threshold
if (result.riskScore >= 70) { /* suspend */ }              // Suspend threshold
```

### Adding Custom Rules
1. Create new rule file in `src/fraud/rules/`
2. Export async function returning `{ score: number, reason: string }`
3. Add to `evaluateAllRules()` in `src/fraud/score.ts`
4. Update weights and documentation

## Troubleshooting

### High False Positive Rate
- Lower alert threshold in `fraud.service.ts`
- Reduce rule weights for overly-sensitive rules
- Review alert samples to identify problematic patterns

### Missing Alerts
- Check middleware registration in `app.module.ts`
- Verify database connection and migration ran
- Confirm user/IP/device data is being sent in requests

### Performance Degradation
- Monitor in-memory Map sizes (potential memory leak)
- Check Redis connection if using distributed state
- Review database query performance on `fraud_alerts` table

## Future Enhancements

- **Geographic Anomaly Detection**: Flag impossible IP location changes
- **Card/Payment Method Tracking**: Detect card abuse patterns
- **ML-Based Scoring**: Integrate ML model for dynamic thresholds
- **Real-Time Alerting**: Webhook notifications for high-risk transactions
- **Distributed State**: Redis-backed rule state for horizontal scaling
- **Rate-Limited Admin Actions**: Protect review endpoints with rate limiting
- **Custom Rule Engine**: User-defined rule configuration UI

## Security Notes

- **All fraud actions are logged** with full context for audit compliance
- **Immutable audit trail**: All fraud alerts, lockouts, and reviews are recorded in the central audit system
- **Admin endpoints are protected** with role-based access control (JWT + AdminGuard)
- **Risk scores are recalculated** on each request (no caching)
- **Automatic suspension** provides real-time protection against brute attacks
- **Middleware fails open**: allows requests if fraud service fails
- **Lockout semantics**: Accounts are locked after 3 fraud flags within 60 minutes
- **Complete state tracking**: Previous and new states are recorded for all fraud actions
- **Searchable audit logs**: Admins can query fraud events by user, date range, action type, and resource
- **Review accountability**: All admin reviews are tracked with reviewer ID, timestamp, and notes

## References

- [NestJS Middleware Documentation](https://docs.nestjs.com/middleware)
- [TypeORM Entities](https://typeorm.io/entities)
- [Redis Rate Limiting Patterns](https://redis.io/commands/incrby/)
