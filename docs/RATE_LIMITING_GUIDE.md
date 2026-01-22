# Rate Limiting & Security - Implementation Guide

## Quick Start

### 1. Rate Limiting is Already Global

All endpoints are automatically rate limited (100 requests per 15 minutes). No additional setup required!

```bash
# Test it
curl http://localhost:3000/api/status
# Returns: 200 OK with X-RateLimit-* headers

# Make 101 requests - 101st will return 429 Too Many Requests
```

### 2. Apply Stricter Rate Limits to Sensitive Endpoints

```typescript
import { Controller, Post, Body } from '@nestjs/common';
import { RateLimit } from '@/common/decorators/rate-limit.decorator';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  @Post('login')
  @RateLimit('LOGIN')  // 5 attempts per 15 minutes
  async login(@Body() dto: LoginDto) {
    // Your implementation
  }

  @Post('register')
  @RateLimit('REGISTER')  // 3 attempts per hour
  async register(@Body() dto: RegisterDto) {
    // Your implementation
  }

  @Post('forgot-password')
  @RateLimit('PASSWORD_RESET')  // 3 attempts per hour
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    // Your implementation
  }

  @Post('payment')
  @RateLimit('PAYMENT')  // 10 requests per hour
  async processPayment(@Body() dto: PaymentDto) {
    // Your implementation
  }
}
```

### 3. Skip Rate Limiting (Only When Necessary)

```typescript
import { Controller, Get } from '@nestjs/common';
import { SkipRateLimit } from '@/common/decorators/rate-limit.decorator';

@Controller('health')
export class HealthController {
  @Get('check')
  @SkipRateLimit()  // Health checks shouldn't be rate limited
  async healthCheck() {
    return { status: 'ok' };
  }
}
```

### 4. Custom Rate Limits

```typescript
@Post('bulk-export')
@RateLimit('CUSTOM', { limit: 2, windowMs: 86400000 })  // 2 per day
async bulkExport(@Body() dto: ExportDto) {
  // Your implementation
}
```

---

## Available Rate Limit Types

```typescript
// From src/common/config/rate-limit.config.ts
type RateLimitType = 
  | 'AUTH'           // 5 per 15 min
  | 'LOGIN'          // 5 per 15 min
  | 'REGISTER'       // 3 per hour
  | 'PASSWORD_RESET' // 3 per hour
  | 'API'            // 100 per 15 min (default)
  | 'UPLOAD'         // 10 per hour
  | 'TRANSACTION'    // 20 per minute
  | 'PAYMENT'        // 10 per hour
  | 'SEARCH'         // 30 per 5 min
  | 'EXPORT'         // 5 per hour
  | 'CUSTOM';        // Define your own
```

---

## Security Features

### Automatic Security Headers

All responses automatically include security headers:

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000
Content-Security-Policy: default-src 'self'
```

### Request Size Limits

Configured in `.env`:
```bash
MAX_JSON_SIZE=10mb          # JSON payloads
MAX_URLENCODED_SIZE=10mb    # Form data
MAX_FILE_SIZE=50mb          # File uploads
```

### Injection Attack Detection

The middleware automatically detects and logs:
- SQL injection attempts
- XSS injection attempts
- Path traversal attempts
- Null byte injection

These are logged but not blocked by default. Applications should implement their own validation.

### IP Blocking

```typescript
// In admin controller
import { SecurityMiddleware } from '@/common/middleware/security.middleware';

@Controller('admin/security')
export class SecurityController {
  constructor(
    @Inject(SecurityMiddleware)
    private securityMiddleware: SecurityMiddleware,
  ) {}

  @Post('block-ip')
  blockIP(@Body() dto: BlockIPDto) {
    this.securityMiddleware.blockIP(dto.ip);
    return { message: `IP ${dto.ip} has been blocked` };
  }

  @Delete('block-ip/:ip')
  unblockIP(@Param('ip') ip: string) {
    this.securityMiddleware.unblockIP(ip);
    return { message: `IP ${ip} has been unblocked` };
  }
}
```

---

## Rate Limit Response Example

```bash
# Request that hits the limit:
curl -X GET http://localhost:3000/api/listings \
  -H "X-Forwarded-For: 203.0.113.1"

# First 100 requests return 200 OK
# 101st request returns:
HTTP/1.1 429 Too Many Requests

{
  "statusCode": 429,
  "message": "Too many requests. Please try again in 847 seconds.",
  "retryAfter": 847
}

# Response headers:
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1642857600
```

---

## Environment Configuration

Create `.env` file:

```bash
# Rate Limits (in milliseconds)
RATE_LIMIT_AUTH_LIMIT=5
RATE_LIMIT_AUTH_WINDOW=900000

RATE_LIMIT_LOGIN_LIMIT=5
RATE_LIMIT_LOGIN_WINDOW=900000

RATE_LIMIT_REGISTER_LIMIT=3
RATE_LIMIT_REGISTER_WINDOW=3600000

RATE_LIMIT_PASSWORD_LIMIT=3
RATE_LIMIT_PASSWORD_WINDOW=3600000

RATE_LIMIT_API_LIMIT=100
RATE_LIMIT_API_WINDOW=900000

# Request Size Limits
MAX_JSON_SIZE=10mb
MAX_URLENCODED_SIZE=10mb
MAX_FILE_SIZE=50mb

# CORS
CORS_ORIGIN=http://localhost:3000,https://app.marketx.com

# IP Management
BLOCKED_IPS=192.0.2.1,192.0.2.2
IP_WHITELIST=203.0.113.1
ENABLE_IP_WHITELIST=false
```

---

## Testing Rate Limits

### Manual Testing

```bash
#!/bin/bash
# Test rate limiting - make 10 rapid requests

for i in {1..10}; do
  echo "Request $i:"
  curl -X GET http://localhost:3000/api/status \
    -H "X-Forwarded-For: 192.0.2.100" \
    -w "\nStatus: %{http_code}\n\n"
  sleep 0.5
done
```

### Automated Testing

```typescript
// In your test file
import * as request from 'supertest';

describe('Rate Limiting', () => {
  it('should enforce rate limits', async () => {
    const ip = '10.0.0.100';

    // Make requests up to the limit
    for (let i = 0; i < 100; i++) {
      await request(app.getHttpServer())
        .get('/api/listings')
        .set('X-Forwarded-For', ip);
    }

    // This one should be rate limited
    const response = await request(app.getHttpServer())
      .get('/api/listings')
      .set('X-Forwarded-For', ip);

    expect(response.status).toBe(429);
    expect(response.body.retryAfter).toBeDefined();
  });
});
```

### Load Testing with Apache Bench

```bash
# Install: apt-get install apache2-utils

# Test with rate limiting
ab -n 200 -c 10 http://localhost:3000/api/status

# Expected: Some requests will get 429 responses
```

---

## Common Patterns

### Client-Side Rate Limit Handling (JavaScript)

```javascript
async function makeAPIRequest(url, options = {}, maxRetries = 5) {
  let retries = 0;

  while (retries < maxRetries) {
    try {
      const response = await fetch(url, options);

      // Success
      if (response.ok) {
        return response.json();
      }

      // Rate limited
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('retry-after') || '60');
        const waitTime = retryAfter * 1000;

        console.log(`Rate limited. Waiting ${retryAfter}s before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));

        retries++;
        continue;
      }

      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (error) {
      console.error('Request failed:', error);
      throw error;
    }
  }

  throw new Error('Max retries exceeded');
}

// Usage
try {
  const data = await makeAPIRequest('http://localhost:3000/api/data');
  console.log('Success:', data);
} catch (error) {
  console.error('Failed:', error);
}
```

### Batch Requests to Avoid Rate Limits

```typescript
// Bad: 100 individual requests
async function getBadUserIds(ids: string[]) {
  return Promise.all(ids.map(id => fetchUser(id)));
}

// Good: Batch requests
async function getBatchUserIds(ids: string[]) {
  const batchSize = 50;
  const results = [];

  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const batchResults = await fetchUsersBatch(batch);
    results.push(...batchResults);
  }

  return results;
}
```

---

## Monitoring & Debugging

### Check Rate Limit Status

```bash
# Make a request and check headers
curl -v http://localhost:3000/api/status | grep X-RateLimit

# Output:
# X-RateLimit-Limit: 100
# X-RateLimit-Remaining: 99
# X-RateLimit-Reset: 1642857600
```

### View Application Logs

```bash
# Watch security logs
tail -f logs/app.log | grep SECURITY

# Watch rate limit violations
tail -f logs/app.log | grep RATE-LIMIT
```

### Debug Rate Limiting

```typescript
// In throttle.guard.ts
// Uncomment console.logs for debugging:
console.log(`Client: ${clientId}, Count: ${record.count}, Limit: ${config.limit}`);
console.log(`Time until reset: ${record.resetTime - now}ms`);
```

---

## Troubleshooting

### Issue: Rate limiting not working

**Check**:
1. Is `ThrottleGuard` registered as `APP_GUARD` in `AppModule`?
2. Does endpoint have `@SkipRateLimit()` decorator?
3. Check X-Forwarded-For header is being passed correctly

### Issue: All requests are rate limited

**Check**:
1. Verify X-Forwarded-For header format (should be IP:port)
2. Check if IP is in BLOCKED_IPS list
3. Verify rate limit window hasn't been exceeded

### Issue: Different rate limits not working

**Check**:
1. Decorator name matches available types (AUTH, LOGIN, REGISTER, etc.)
2. Endpoint path contains the right keyword for automatic detection
3. Check environment variables are set correctly

---

## Performance Considerations

### Memory Usage

- Rate limit data stored in-memory per client
- Automatically cleaned up after window expires
- Typical: <1MB per 1000 active clients

### Optimization Tips

1. Use Redis for distributed deployments (future enhancement)
2. Increase cleanup interval for high-traffic scenarios
3. Batch requests on client side
4. Implement client-side caching

---

## Production Checklist

Before deploying to production:

- [ ] Configure appropriate rate limits for each endpoint
- [ ] Update CORS_ORIGIN to your domain
- [ ] Set MAX_FILE_SIZE appropriate for your use case
- [ ] Configure IP_WHITELIST if needed
- [ ] Set up log aggregation
- [ ] Configure alerts for security events
- [ ] Test rate limiting under load
- [ ] Document custom rate limits for your team
- [ ] Set up monitoring dashboards
- [ ] Review security headers are present

---

## Additional Resources

- **Full Security Documentation**: [docs/security.md](./security.md)
- **Rate Limit Config**: [src/common/config/rate-limit.config.ts](../src/common/config/rate-limit.config.ts)
- **Throttle Guard**: [src/common/guards/throttle.guard.ts](../src/common/guards/throttle.guard.ts)
- **Security Middleware**: [src/common/middleware/security.middleware.ts](../src/common/middleware/security.middleware.ts)
- **Rate Limit Tests**: [test/rate-limiting-security.e2e-spec.ts](../test/rate-limiting-security.e2e-spec.ts)
