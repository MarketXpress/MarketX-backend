# Fraud Detection System

## Overview

The Fraud Detection System is a comprehensive fraud prevention service that monitors suspicious activity, flags risky transactions, and implements automated protection measures. It combines multiple detection rules to calculate a risk score and automatically takes protective actions.

## Features

- **Velocity Monitoring**: Detects rapid-fire requests from the same user
- **Duplicate Order Detection**: Identifies repeated order attempts
- **IP/Device Fingerprinting**: Tracks and flags suspicious device reuse patterns
- **Risk Scoring**: Weighted aggregation of multiple fraud signals (0-100)
- **Automatic Suspension**: Auto-blocks high-risk requests (score ≥ 70)
- **Admin Review Queue**: Manual review interface for flagged transactions
- **Audit Logging**: Maintains comprehensive fraud attempt logs
- **Request Monitoring**: Global middleware that analyzes all requests

## Architecture

### Core Components

#### 1. **FraudAlert Entity** (`entities/fraud-alert.entity.ts`)
Stores fraud detection records with:
- Risk score (0-100)
- User, order, IP, and device fingerprint tracking
- Status: `pending`, `reviewed`, `suspended`, `safe`
- Metadata for additional context

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

#### 5. **RequestMonitorMiddleware** (`middleware/request-monitor.middleware.ts`)
Global middleware applied to all requests:
- Extracts user ID, IP, device fingerprint from request headers
- Calls `analyzeRequest()`
- Auto-blocks requests with score ≥ 90

#### 6. **Admin Controllers** (`../admin/admin-fraud.controller.ts`)
HTTP endpoints for admin dashboard:
- `GET /admin/fraud/alerts` - List all alerts
- `PATCH /admin/fraud/:id/review` - Update alert status

#### 7. **Public Controller** (`fraud.controller.ts`)
Public endpoints:
- `GET /fraud/alerts` - Paginated alert list (public)

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
  createdAt TIMESTAMP DEFAULT NOW()
);
```

**Migration**: `src/migrations/1680000000000-CreateFraudAlerts.ts`

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
# Get all alerts
curl http://localhost:3000/admin/fraud/alerts

# Response:
[
  {
    "id": "uuid-1",
    "userId": "user-123",
    "riskScore": 65,
    "status": "pending",
    "reason": "velocity:25/min;duplicate:repeat-order",
    "createdAt": "2026-02-19T20:30:00Z"
  }
]

# Mark as reviewed
curl -X PATCH http://localhost:3000/admin/fraud/468/review \
  -H "Content-Type: application/json" \
  -d '{"mark": "safe"}'

# Response: Updated alert with status="safe"
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

- All alerts are logged with full context for audit compliance
- Admin endpoints should be protected with role-based access control
- Risk scores are recalculated on each request (no caching)
- Automatic suspension provides real-time protection against brute attacks
- Middleware fails open: allows requests if fraud service fails

## References

- [NestJS Middleware Documentation](https://docs.nestjs.com/middleware)
- [TypeORM Entities](https://typeorm.io/entities)
- [Redis Rate Limiting Patterns](https://redis.io/commands/incrby/)
