# Rate Limiting System

## Overview

The MarketX backend implements a sophisticated multi-tier rate limiting system to prevent API abuse and ensure fair usage across different user tiers. The system uses Redis for distributed rate limiting with sliding window algorithms.

## Features

- **Multi-tier Rate Limiting**: Different limits for FREE, PREMIUM, ENTERPRISE, and ADMIN users
- **Multiple Strategies**: IP-based, user-based, and endpoint-specific rate limiting
- **Sliding Window Algorithm**: More accurate than fixed windows, handles burst traffic better
- **Configurable Limits**: Admin panel for real-time configuration updates
- **Rate Limit Headers**: Standard HTTP headers in responses
- **Analytics & Monitoring**: Detailed analytics for rate limit usage
- **Graceful Degradation**: Fails open if Redis is unavailable

## Architecture

### Components

1. **RateLimitService**: Core service handling rate limit logic
2. **RateLimitGuard**: NestJS guard that enforces rate limits
3. **RateLimit Decorators**: Easy-to-use decorators for controllers
4. **Admin Controller**: Management interface for rate limit configuration
5. **Redis Storage**: Distributed storage for rate limit counters

### User Tiers

| Tier | Window | Max Requests | Burst Allowance |
|------|--------|--------------|-----------------|
| FREE | 1 minute | 10 | 3 |
| PREMIUM | 1 minute | 50 | 10 |
| ENTERPRISE | 1 minute | 200 | 50 |
| ADMIN | 1 minute | 1000 | 200 |

### Endpoint-Specific Limits

| Endpoint | Window | Max Requests | Burst |
|----------|--------|--------------|-------|
| `/auth/login` | 15 minutes | 5 | 0 |
| `/auth/register` | 1 hour | 3 | 0 |
| `/listings` | 1 minute | 30 | 5 |
| `/search` | 1 minute | 20 | 3 |

## Usage

### Basic Rate Limiting

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { RateLimit, RateLimitGuard } from '../rate-limiting';

@Controller('api')
@UseGuards(RateLimitGuard)
export class ApiController {
  @Get('data')
  @RateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,
    burstAllowance: 2
  })
  getData() {
    return { data: 'example' };
  }
}
```

### Tier-Based Rate Limiting

```typescript
@RateLimit({
  windowMs: 60 * 1000,
  maxRequests: 5, // Default for FREE tier
  tierLimits: {
    [UserTier.PREMIUM]: { maxRequests: 20 },
    [UserTier.ENTERPRISE]: { maxRequests: 100 }
  }
})
@Post('upload')
uploadFile() {
  return this.fileService.upload();
}
```

### Strict Rate Limiting (No Burst)

```typescript
@StrictRateLimit({ 
  maxRequests: 3, 
  windowMs: 15 * 60 * 1000 // 15 minutes
})
@Post('sensitive-action')
performSensitiveAction() {
  return this.actionService.perform();
}
```

### IP-Based Rate Limiting

```typescript
@IpRateLimit({ 
  maxRequests: 100, 
  windowMs: 60 * 1000 
})
@Get('public-api')
getPublicData() {
  return this.dataService.getPublicData();
}
```

### Disable Rate Limiting

```typescript
@NoRateLimit()
@Get('health')
healthCheck() {
  return { status: 'ok' };
}
```

## Configuration

### Environment Variables

```bash
# Redis Configuration
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your_redis_password
REDIS_DB=0

# Rate Limiting Settings
RATE_LIMIT_ENABLED=true
RATE_LIMIT_SKIP_FAILED_REQUESTS=false
RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS=false

# Default Tier Limits
FREE_TIER_WINDOW_MS=60000
FREE_TIER_MAX_REQUESTS=10
FREE_TIER_BURST_ALLOWANCE=3

PREMIUM_TIER_WINDOW_MS=60000
PREMIUM_TIER_MAX_REQUESTS=50
PREMIUM_TIER_BURST_ALLOWANCE=10
```

### Runtime Configuration

Use the admin API to update configurations:

```bash
# Update tier configuration
PUT /admin/rate-limits/config/tiers/premium
{
  "windowMs": 60000,
  "maxRequests": 100,
  "burstAllowance": 20
}

# Update endpoint configuration
PUT /admin/rate-limits/config/endpoints/%2Fapi%2Flogin
{
  "windowMs": 900000,
  "maxRequests": 3,
  "burstAllowance": 0
}
```

## Response Headers

All rate-limited endpoints include these headers:

- `X-RateLimit-Limit`: Maximum requests allowed in window
- `X-RateLimit-Remaining`: Remaining requests in current window
- `X-RateLimit-Reset`: Unix timestamp when window resets
- `X-RateLimit-Window`: Window duration in milliseconds
- `X-RateLimit-Burst`: Additional burst requests allowed
- `Retry-After`: Seconds to wait before retry (only when limited)

## Rate Limited Response

When rate limited, the API returns:

```json
{
  "statusCode": 429,
  "message": "Too many requests. Please try again later.",
  "error": "Too Many Requests",
  "retryAfter": 30,
  "rateLimit": {
    "limit": 10,
    "remaining": 0,
    "reset": "2025-07-01T10:05:00.000Z",
    "window": 60000
  }
}
```

## Admin Operations

### Analytics

```bash
GET /admin/rate-limits/analytics?days=7
```

Returns detailed analytics including:
- Request counts by user/IP
- Blocked request statistics  
- Top consumers
- Endpoint usage patterns

### Reset Rate Limits

```bash
POST /admin/rate-limits/reset
{
  "identifier": "user:123",
  "endpoint": "/api/listings"
}
```

### Check Status

```bash
GET /admin/rate-limits/status?identifier=user:123&endpoint=/api/listings
```

Returns current rate limit status for an identifier.

### Health Check

```bash
GET /admin/rate-limits/health
```

Checks Redis connectivity and service health.

## Implementation Details

### Sliding Window Algorithm

The system uses a sliding window algorithm implemented with Redis sorted sets:

1. Remove expired entries from the current window
2. Count current requests in the window
3. Add the new request with current timestamp
4. Check if count exceeds limit (including burst allowance)
5. Set expiration for the key

### Key Generation

Rate limit keys are generated as:
- User-based: `rate_limit:user:{userId}`
- IP-based: `rate_limit:ip:{ipAddress}`  
- Endpoint-specific: `rate_limit:user:{userId}:{endpoint}`

### Burst Allowance

Burst allowance allows temporary spikes above the normal limit:
- Total allowed = maxRequests + burstAllowance
- Provides flexibility for legitimate usage patterns
- Can be set to 0 for strict limits

### Client IP Detection

The system detects client IPs from multiple sources:
1. `X-Forwarded-For` header (for proxies/load balancers)
2. `X-Real-IP` header
3. `CF-Connecting-IP` header (Cloudflare)
4. Direct connection IP

### User Tier Detection

User tiers are detected from the request user object:
1. Check for admin role
2. Check explicit tier property
3. Check subscription property
4. Default to FREE tier

## Testing

Run the rate limiting tests:

```bash
# Unit tests
npm test rate-limit.service.spec.ts
npm test rate-limit.guard.spec.ts

# E2E tests
npm run test:e2e rate-limiting.e2e-spec.ts
```

## Monitoring

### Key Metrics

- **Request Rate**: Requests per second/minute
- **Block Rate**: Percentage of requests blocked
- **Top Consumers**: Users/IPs with highest usage
- **Endpoint Usage**: Most accessed endpoints
- **Error Rate**: Rate limiting errors

### Alerts

Set up monitoring alerts for:
- High block rates (>5%)
- Redis connectivity issues
- Unusual traffic patterns
- Rapid consumption by single user/IP

## Troubleshooting

### Common Issues

1. **Redis Connection Errors**
   - Check Redis URL and connectivity
   - Verify Redis server is running
   - Check network/firewall settings

2. **Unexpected Rate Limiting**
   - Check user tier configuration
   - Verify endpoint-specific limits
   - Review recent configuration changes

3. **Rate Limits Not Working**
   - Ensure RateLimitGuard is applied
   - Check if endpoint has @NoRateLimit decorator
   - Verify Redis is storing data

### Debug Mode

Enable debug logging:

```typescript
// In rate-limit.service.ts
private readonly logger = new Logger(RateLimitService.name, { timestamp: true });
```

### Manual Testing

Use curl to test rate limits:

```bash
# Test login rate limit
for i in {1..10}; do
  curl -X POST http://localhost:3000/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"password"}' \
    -v
done
```

## Security Considerations  

1. **IP Spoofing**: Validate forwarded headers in production
2. **Redis Security**: Use authentication and encryption
3. **DDoS Protection**: Rate limiting is first line of defense
4. **Bypass Attempts**: Monitor for suspicious patterns

## Performance

### Redis Optimization

- Use Redis pipelining for atomic operations
- Set appropriate key expiration times
- Monitor Redis memory usage
- Consider Redis clustering for scale

### Application Performance

- Rate limiting adds ~1-2ms latency per request
- Uses non-blocking Redis operations
- Graceful degradation if Redis unavailable
- Efficient key generation and lookup

## Future Enhancements

1. **Geolocation-based Limits**: Different limits by region
2. **Dynamic Scaling**: Auto-adjust limits based on load
3. **Machine Learning**: Detect and block suspicious patterns
4. **WebSocket Rate Limiting**: Extend to real-time connections
5. **API Key Rate Limiting**: Per-API-key limits for external access
