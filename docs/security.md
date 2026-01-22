# API Security & Rate Limiting Documentation

## Overview

This document outlines the comprehensive API security and rate limiting policies implemented in the MarketX backend. The system is designed to protect against abuse, data breaches, and attacks while maintaining a positive experience for legitimate users.

**Last Updated**: January 22, 2026  
**Version**: 1.0.0

---

## Table of Contents

1. [Rate Limiting](#rate-limiting)
2. [Security Middleware](#security-middleware)
3. [Request Validation](#request-validation)
4. [IP Blocking & Whitelisting](#ip-blocking--whitelisting)
5. [Security Headers](#security-headers)
6. [Configuration](#configuration)
7. [Monitoring & Alerts](#monitoring--alerts)
8. [Best Practices](#best-practices)
9. [Troubleshooting](#troubleshooting)

---

## Rate Limiting

### Overview

Rate limiting is implemented using a custom in-memory throttle guard that tracks requests by client (user ID for authenticated requests, IP address for anonymous requests). Different endpoints have different rate limits based on sensitivity.

### Rate Limit Tiers

#### Tier 1: Critical Authentication Endpoints (Most Restrictive)
- **Login**: 5 requests per 15 minutes
- **Registration**: 3 requests per hour
- **Password Reset**: 3 requests per hour
- **2FA Verification**: 10 requests per 15 minutes

**Rationale**: These endpoints are targets for brute-force attacks and credential stuffing. Strict limits protect user accounts.

#### Tier 2: Sensitive Operations (Restrictive)
- **Payment Processing**: 10 requests per hour
- **Transaction Creation**: 20 requests per minute
- **Dispute Filing**: 5 requests per hour
- **Account Closure**: 1 request per day

**Rationale**: These operations involve financial transactions or account changes. Limits prevent accidental or malicious mass operations.

#### Tier 3: Standard API Endpoints (Moderate)
- **Create Listing**: 20 requests per hour
- **Search/Query**: 30 requests per 5 minutes
- **User Profile Updates**: 10 requests per hour
- **General API**: 100 requests per 15 minutes

**Rationale**: Normal user operations. Limits prevent resource exhaustion while allowing normal usage.

#### Tier 4: File Operations (Moderate)
- **File Upload**: 10 requests per hour
- **Image Processing**: 5 requests per minute
- **Export/Download**: 5 requests per hour

**Rationale**: File operations are resource-intensive. Limits prevent disk and bandwidth exhaustion.

### Rate Limit Response

When a client exceeds the rate limit, the API responds with:

```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1642857600

{
  "statusCode": 429,
  "message": "Too many requests. Please try again in 847 seconds.",
  "retryAfter": 847
}
```

### Rate Limit Headers

All responses include rate limit information in headers:

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Total requests allowed in the current window |
| `X-RateLimit-Remaining` | Requests remaining in current window |
| `X-RateLimit-Reset` | Unix timestamp when the window resets |

### Client Identification

#### Authenticated Requests
- Rate limits are based on **User ID**: `user:{userId}`
- Limits are shared across all devices/sessions for the same user
- Useful for detecting account abuse

#### Anonymous Requests
- Rate limits are based on **IP Address**: `ip:{ipAddress}`
- X-Forwarded-For header is respected (for reverse proxies)
- Falls back to direct socket IP if headers unavailable

**Priority Order for IP Detection**:
1. First IP in `X-Forwarded-For` header
2. `X-Real-IP` header
3. Direct socket connection IP

### Applying Rate Limits to Endpoints

#### Global Rate Limiting
All endpoints are automatically rate limited with the API default limit (100/15min). The throttle guard is registered as a global APP_GUARD.

#### Custom Rate Limits via Decorator

```typescript
import { RateLimit } from '@/common/decorators/rate-limit.decorator';

@Controller('auth')
export class AuthController {
  @Post('login')
  @RateLimit('LOGIN') // 5 per 15 minutes
  login(@Body() credentials: LoginDto) {
    // Implementation
  }

  @Post('register')
  @RateLimit('REGISTER') // 3 per hour
  register(@Body() dto: RegisterDto) {
    // Implementation
  }

  @Post('forgot-password')
  @RateLimit('PASSWORD_RESET') // 3 per hour
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    // Implementation
  }

  // Custom limit
  @Post('verify-email')
  @RateLimit('CUSTOM', { limit: 5, windowMs: 300000 })
  verifyEmail(@Body() dto: VerifyEmailDto) {
    // Implementation
  }
}
```

#### Skipping Rate Limits

For public health checks or admin endpoints that should bypass rate limiting:

```typescript
import { SkipRateLimit } from '@/common/decorators/rate-limit.decorator';

@Get('health')
@SkipRateLimit()
health() {
  return { status: 'ok' };
}
```

---

## Security Middleware

### Overview

The security middleware provides defense-in-depth protection against common web attacks:

1. IP blocking/whitelisting
2. Request size validation
3. Injection attack detection
4. Security header injection
5. Request sanitization
6. Audit logging

### Features

#### 1. IP Blocking & Whitelisting

Block known malicious IPs or restrict access to whitelisted IPs only.

**Configuration**:
```bash
# Comma-separated list of IPs to block
BLOCKED_IPS=192.0.2.1,192.0.2.2,203.0.113.0

# Comma-separated list of allowed IPs (whitelist mode)
IP_WHITELIST=203.0.113.100,203.0.113.101

# Enable whitelist mode (default: false)
ENABLE_IP_WHITELIST=false
```

**Runtime Management** (via Admin API - to be implemented):
```typescript
// Block an IP
POST /admin/security/ip-blocks
{
  "ip": "192.0.2.5",
  "reason": "Brute force attack",
  "expiresAt": "2026-01-29T00:00:00Z"
}

// Unblock an IP
DELETE /admin/security/ip-blocks/{ip}
```

#### 2. Request Size Limits

Prevents denial-of-service attacks via oversized payloads.

**Configuration**:
```bash
MAX_JSON_SIZE=10mb
MAX_URLENCODED_SIZE=10mb
MAX_FILE_SIZE=50mb
```

**Behavior**:
- Requests exceeding limits receive `400 Bad Request`
- Content-Type determines which limit applies
- Multipart (file uploads) uses FILE limit
- Regular JSON uses JSON limit

#### 3. Injection Attack Detection

Detects and logs common injection patterns:

- **SQL Injection**: `' OR '1'='1`, `DROP TABLE`, etc.
- **XSS**: `<script>`, `javascript:`, `onerror=`, etc.
- **Path Traversal**: `../../../etc/passwd`, `..%2f%2f`
- **Null Byte Injection**: `\x00`, `%00`

Suspicious requests are logged but not blocked by default (applications should implement additional validation).

#### 4. Security Headers

All responses include security-focused HTTP headers:

| Header | Value | Purpose |
|--------|-------|---------|
| `X-Content-Type-Options` | `nosniff` | Prevents MIME type sniffing |
| `X-Frame-Options` | `DENY` | Prevents clickjacking |
| `X-XSS-Protection` | `1; mode=block` | Enables browser XSS filters |
| `Strict-Transport-Security` | `max-age=31536000` | Enforces HTTPS |
| `Content-Security-Policy` | `default-src 'self'` | Restricts resource loading |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Controls referrer information |
| `Permissions-Policy` | Restricts features | Disables geolocation, microphone, camera |

**Customization**:
```bash
HSTS_MAX_AGE=max-age=31536000; includeSubDomains
CSP_POLICY=default-src 'self'; script-src 'self' trusted-cdn.com
```

#### 5. CORS Configuration

Prevents unauthorized cross-origin requests.

**Configuration**:
```bash
# Comma-separated list of allowed origins
CORS_ORIGIN=http://localhost:3000,https://app.marketx.com,https://admin.marketx.com
```

**Configured Methods**: GET, POST, PUT, PATCH, DELETE, OPTIONS

**Allowed Headers**:
- Content-Type
- Authorization
- X-Requested-With
- X-API-Key

**Credentials**: Enabled (allows cookies/auth headers)

#### 6. Request Logging

All security-relevant information is logged:

```
[SECURITY] POST /api/users | IP: 203.0.113.1 | UserAgent: Mozilla/5.0...
[SUSPICIOUS] Potential attack pattern detected from 192.0.2.1: POST /api/search
[RATE-LIMIT-EXCEEDED] 192.0.2.2 exceeded auth limit (5/15min)
```

---

## Request Validation

### Input Validation Pipeline

```
Request → Security Middleware → ValidationPipe → Rate Limiting → Handler
```

### Global Validation Configuration

All endpoints benefit from automatic validation:

```typescript
// In main.ts
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,                  // Remove unknown properties
    forbidNonWhitelisted: true,       // Reject unknown properties
    transform: true,                  // Auto-transform types
    transformOptions: {
      enableImplicitConversion: true,
    },
  }),
);
```

### Per-Endpoint Validation

Use DTOs with class-validator decorators:

```typescript
import { IsEmail, MinLength, MaxLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @MinLength(8)
  @MaxLength(128)
  password: string;

  @MaxLength(100)
  username: string;
}

@Post('register')
@RateLimit('REGISTER')
register(@Body() dto: CreateUserDto) {
  // dto is validated here
}
```

---

## IP Blocking & Whitelisting

### Manual IP Management

#### Block an IP

```bash
# Via admin endpoint (implementation required)
curl -X POST http://localhost:3000/admin/security/block-ip \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ip": "192.0.2.1"}'
```

#### Unblock an IP

```bash
curl -X DELETE http://localhost:3000/admin/security/block-ip/192.0.2.1 \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Automatic IP Blocking (Future)

Future versions should implement automatic blocking based on:
- Failed login attempts (>5 in 15 minutes)
- Rate limit violations (>3 consecutive 429 responses)
- Suspicious request patterns (injection attempts, etc.)
- Reports from security systems

### Whitelist Mode

Enable whitelist mode for high-security scenarios:

```bash
ENABLE_IP_WHITELIST=true
IP_WHITELIST=203.0.113.1,203.0.113.2,203.0.113.0/24
```

**Use Cases**:
- Admin panel access during emergencies
- Partner API integrations
- High-risk operations (refunds, user deletion)

---

## Security Headers

### Recommended Customizations by Environment

#### Development
```bash
CSP_POLICY=default-src 'self' 'unsafe-inline' localhost:3000
HSTS_MAX_AGE=max-age=3600
```

#### Production
```bash
CSP_POLICY=default-src 'self'; script-src 'self'; style-src 'self' fonts.googleapis.com; font-src fonts.gstatic.com
HSTS_MAX_AGE=max-age=31536000; includeSubDomains; preload
```

### Testing Security Headers

```bash
# Check security headers
curl -I https://api.marketx.com/api/status | grep -i "X-\|Strict\|Content-Security\|Referrer"

# Use online tool
# https://securityheaders.com/?q=api.marketx.com
```

---

## Configuration

### Environment Variables

Create `.env` file or use environment-specific files:

```bash
# .env (development)
NODE_ENV=development
RATE_LIMIT_API_LIMIT=100
RATE_LIMIT_API_WINDOW=900000
MAX_JSON_SIZE=10mb
CORS_ORIGIN=http://localhost:3000
BLOCKED_IPS=
```

```bash
# .env.production
NODE_ENV=production
RATE_LIMIT_API_LIMIT=50
RATE_LIMIT_API_WINDOW=900000
MAX_JSON_SIZE=5mb
CORS_ORIGIN=https://app.marketx.com
BLOCKED_IPS=192.0.2.0/24,203.0.113.0/24
ENABLE_IP_WHITELIST=true
IP_WHITELIST=203.0.113.100,203.0.113.101
```

### Runtime Configuration Updates

Rate limiting configuration is evaluated at startup. To update at runtime:

1. **Update environment variables** on the server
2. **Restart the application** (or implement hot-reload)
3. **Verify via logs**: Check application logs for initialization messages

Example startup logs:
```
[Bootstrap] Application started on port 3000
[Bootstrap] Environment: production
[Bootstrap] CORS origins: https://app.marketx.com
[Bootstrap] Max JSON payload: 5mb
[Bootstrap] Max file upload: 50mb
[Bootstrap] Rate limiting configured: AUTH=5/15min, API=50/15min
```

---

## Monitoring & Alerts

### Metrics to Monitor

#### Rate Limiting Metrics
- **Rate limit violations**: Counter of 429 responses
- **Top violators**: IPs/users exceeding limits most frequently
- **Pattern detection**: Unusual request patterns

#### Security Metrics
- **Blocked requests**: Requests blocked due to suspicious content
- **IP blocks**: Active IP blocks and their reasons
- **Header coverage**: Verification that security headers are present

### Logging Strategy

#### Log Levels

```typescript
// Critical security events
this.logger.error('Potential DDoS attack detected from IP: 192.0.2.1');

// Security warnings
this.logger.warn('Rate limit exceeded for user: 123 (50/50 requests)');

// Security information
this.logger.log('IP 192.0.2.5 blocked due to brute force attack');

// Debug security details
this.logger.debug('[SECURITY] POST /api/users | IP: 203.0.113.1');
```

#### Log Aggregation

Configure centralized logging:

```typescript
// Example: Winston with ELK stack
import * as winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new elasticsearch.ElasticsearchTransport({
      level: 'info',
      clientOpts: { node: 'http://localhost:9200' },
      index: 'marketx-logs',
    }),
  ],
});
```

### Alerts

Set up alerts for:

1. **Rate Limit Spike**: >50% increase in 429 responses
2. **Suspicious IPs**: >10 failed login attempts from single IP
3. **Injection Attempts**: Any detected SQL injection/XSS pattern
4. **Large Payloads**: Requests near size limits
5. **Failed CORS**: Cross-origin requests from unauthorized origins

---

## Best Practices

### For Developers

1. **Always use DTOs with validators**
   ```typescript
   export class CreateProductDto {
     @IsString()
     @MaxLength(255)
     name: string;

     @IsNumber()
     @Min(0)
     price: number;
   }
   ```

2. **Apply appropriate rate limits to endpoints**
   ```typescript
   @Post('payment')
   @RateLimit('PAYMENT')
   async createPayment(@Body() dto: PaymentDto) { }
   ```

3. **Handle 429 responses gracefully in clients**
   ```javascript
   if (response.status === 429) {
     const retryAfter = parseInt(response.headers['retry-after']) * 1000;
     setTimeout(() => retryRequest(), retryAfter);
   }
   ```

4. **Never expose sensitive data in error messages**
   ```typescript
   // Bad
   throw new BadRequestException(`User with email ${email} already exists`);

   // Good
   throw new BadRequestException('Account with this email already exists');
   ```

5. **Log security events consistently**
   ```typescript
   this.logger.warn(`Failed login attempt for user ${userId} from IP ${ip}`);
   ```

### For DevOps/Operations

1. **Monitor security metrics dashboards**
   - Rate limit violations over time
   - Top source IPs
   - Error rates by endpoint type

2. **Regular security audits**
   - Review rate limit policies quarterly
   - Update blocked IP lists
   - Analyze suspicious request patterns

3. **Incident response procedures**
   - Define escalation paths for security alerts
   - Maintain playbooks for common attacks
   - Track mean time to resolution (MTTR)

4. **Keep dependencies updated**
   ```bash
   # Regularly update security-related packages
   npm audit
   npm update @nestjs/common @nestjs/throttler
   ```

5. **Test security policies regularly**
   ```bash
   # Run security tests
   npm run test:e2e rate-limiting-security

   # Manual testing
   curl -X GET http://localhost:3000/api/status -H "X-Forwarded-For: 192.0.2.1"
   curl -X GET http://localhost:3000/api/status -H "X-Forwarded-For: 192.0.2.1"
   curl -X GET http://localhost:3000/api/status -H "X-Forwarded-For: 192.0.2.1"
   # ... repeat until 429 response
   ```

### For Client Applications

1. **Implement exponential backoff**
   ```javascript
   async function requestWithBackoff(url, options = {}) {
     let retries = 0;
     while (retries < 5) {
       try {
         const response = await fetch(url, options);
         if (response.status === 429) {
           const waitTime = (response.headers.get('retry-after') || 60) * 1000;
           await sleep(waitTime * Math.pow(2, retries));
           retries++;
           continue;
         }
         return response;
       } catch (error) {
         retries++;
       }
     }
   }
   ```

2. **Cache responses when appropriate**
   - Reduce API calls for static data
   - Implement local caching strategies
   - Use ETag headers for conditional requests

3. **Batch requests when possible**
   ```javascript
   // Bad: 100 individual requests
   for (const id of ids) {
     await fetchUser(id);
   }

   // Good: Batch requests
   await fetchUsers(ids);
   ```

4. **Handle rate limit gracefully**
   - Show user-friendly message
   - Disable retry buttons temporarily
   - Display Retry-After countdown

---

## Troubleshooting

### Common Issues

#### 1. "Too Many Requests" (429) on first request

**Cause**: Incorrect IP configuration in reverse proxy

**Solution**:
```bash
# Verify X-Forwarded-For header is correctly passed
curl -v http://localhost:3000/api/test | grep X-Forwarded-For

# Check proxy configuration (nginx example):
# proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
# proxy_set_header X-Real-IP $remote_addr;
```

#### 2. Rate limit not working

**Cause**: Rate limit guard not registered or endpoint has @SkipRateLimit

**Solution**:
```typescript
// Verify in app.module.ts:
providers: [
  {
    provide: APP_GUARD,
    useClass: ThrottleGuard,  // Should be present
  },
],

// Check for @SkipRateLimit decorator
@Get('test')
@SkipRateLimit()  // Remove if rate limiting is desired
test() { }
```

#### 3. CORS errors in client

**Cause**: Origin not in CORS_ORIGIN list

**Solution**:
```bash
# Update .env
CORS_ORIGIN=https://yourfrontend.com,http://localhost:3000

# Verify
curl -X OPTIONS http://localhost:3000/api/test \
  -H "Origin: https://yourfrontend.com" \
  -v | grep Access-Control
```

#### 4. Security header warnings

**Cause**: CSP policy too restrictive or missing resources

**Solution**:
```bash
# Update CSP to allow legitimate resources
CSP_POLICY=default-src 'self'; script-src 'self' trusted-cdn.com; style-src 'self' fonts.googleapis.com
```

#### 5. Performance degradation

**Cause**: Too many clients in memory, cleanup not running

**Solution**:
```typescript
// Check cleanup interval in throttle.guard.ts
setInterval(() => this.cleanupExpiredRecords(), 5 * 60 * 1000); // Every 5 minutes

// Monitor memory usage
process.memoryUsage(); // Should remain stable
```

### Debug Mode

Enable detailed logging:

```bash
# Set environment
NODE_ENV=development
LOG_LEVEL=debug

# Check logs for security middleware output
grep -i "SECURITY\|SUSPICIOUS\|RATE-LIMIT" app.log
```

### Performance Tuning

For high-traffic deployments:

```bash
# Reduce cleanup interval
# In throttle.guard.ts: setInterval(..., 1 * 60 * 1000); // Every 1 minute

# Or use Redis for distributed rate limiting (future enhancement):
# providers: [
#   {
#     provide: APP_GUARD,
#     useClass: RedisThrottleGuard,
#   },
# ],
```

---

## Future Enhancements

### Planned Features

1. **Redis-based rate limiting** for distributed systems
2. **Automated IP blocking** based on threat patterns
3. **Machine learning anomaly detection** for suspicious patterns
4. **Geographic-based rate limits** (stricter for high-risk regions)
5. **Device fingerprinting** for better abuse detection
6. **Custom rate limit policies per user tier** (premium vs free)
7. **Admin dashboard** for real-time security monitoring
8. **Integration with external threat intelligence** (AbuseIPDB, etc.)

### Deployment Considerations

1. **Kubernetes**: Use horizontal pod autoscaling with shared rate limit store
2. **Serverless**: Implement distributed rate limiting with external store
3. **Multi-region**: Centralize rate limit data in global cache
4. **Zero-downtime deployment**: Maintain rate limit state during updates

---

## References

### Security Standards
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP Rate Limiting](https://cheatsheetseries.owasp.org/cheatsheets/Denial_of_Service_Prevention_Cheat_Sheet.html)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)

### HTTP Security Headers
- [MDN: HTTP Headers](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers)
- [HSTS](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Strict-Transport-Security)
- [CSP](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)

### NestJS Documentation
- [Guards](https://docs.nestjs.com/guards)
- [Middleware](https://docs.nestjs.com/middleware)
- [Pipes](https://docs.nestjs.com/pipes)
- [Interceptors](https://docs.nestjs.com/interceptors)

---

## Support & Questions

For questions or issues related to API security:
1. Check this documentation
2. Review the code comments in `src/common/`
3. Check application logs for security warnings
4. Contact: security@marketx.com

---

**Document Version**: 1.0.0  
**Last Updated**: January 22, 2026  
**Next Review Date**: April 22, 2026
