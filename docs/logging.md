# Logging and Monitoring System

## Overview

The MarketX backend implements a comprehensive logging and monitoring system using Winston, custom interceptors, and exception filters. This system provides structured logging, performance tracking, and error monitoring across all services.

## Features

- ✅ Structured logging with Winston
- ✅ Multiple log levels: error, warn, info, debug
- ✅ Automatic request/response tracking with timestamps
- ✅ Performance monitoring and slow query detection
- ✅ Sensitive data redaction (passwords, tokens, keys)
- ✅ Daily rotating log files
- ✅ Console and file transports
- ✅ Exception tracking and stack traces
- ✅ Database query logging (development only)
- ✅ Authentication event tracking

## Log Levels

Log levels are configured in order of severity:

| Level | Usage |
|-------|-------|
| **error** | Critical errors that need immediate attention |
| **warn** | Warnings about potentially problematic situations |
| **info** | General informational messages about application flow |
| **debug** | Detailed debugging information (development only) |

Set log level via environment variable: `LOG_LEVEL=debug`

## Architecture

### Components

#### 1. **LoggerService** (`common/logger/logger.service.ts`)

Core logger service that handles all logging operations with built-in data sanitization.

**Methods:**
```typescript
// Basic logging
error(message: string, context?: any, error?: Error): void
warn(message: string, context?: any): void
info(message: string, context?: any): void
debug(message: string, context?: any): void

// Request/Response logging
logRequest(method, url, query?, body?, ip?): void
logResponse(method, url, statusCode, responseTime, user?): void

// Performance tracking
logPerformance(action: string, duration: number, metadata?: any): void

// Database operations
logDatabaseQuery(query: string, parameters?: any[], duration?: number): void

// Authentication events
logAuthEvent(event: 'login' | 'logout' | 'failed_login' | 'token_refresh', userId?, metadata?): void
```

**Example:**
```typescript
import { LoggerService } from './common/logger/logger.service';

@Injectable()
export class UserService {
  constructor(private logger: LoggerService) {}

  async createUser(userData: CreateUserDto) {
    try {
      this.logger.info('Creating new user', { email: userData.email });
      
      const user = await this.userRepository.save(userData);
      
      this.logger.info('User created successfully', { userId: user.id });
      return user;
    } catch (error) {
      this.logger.error('Failed to create user', { email: userData.email }, error);
      throw error;
    }
  }
}
```

#### 2. **LoggingInterceptor** (`common/interceptors/logging.interceptor.ts`)

Global interceptor that automatically logs all HTTP requests and responses.

**Features:**
- Tracks request/response cycle
- Measures response time
- Logs performance metrics for slow requests (>1000ms)
- Captures request method, URL, query parameters, and user info
- Logs errors with full stack trace

#### 3. **HttpExceptionFilter** (`common/filters/http-exception.filter.ts`)

Global exception filter for comprehensive error logging and standardized error responses.

**Features:**
- Logs all HTTP exceptions with context
- Distinguishes between client errors (4xx) and server errors (5xx)
- Includes stack traces in development mode only
- Sanitizes sensitive data from error responses

#### 4. **RequestResponseMiddleware** (`common/middleware/request-response.middleware.ts`)

Middleware for low-level request/response logging with performance tracking.

**Features:**
- Captures complete request/response cycle
- Skips health check and static asset logging
- Logs user agent and IP information
- Measures full request duration

## Log Format

### Console Output Example
```
2026-01-23 14:30:45 [INFO] Incoming Request { method: 'POST', url: '/api/users', ip: '192.168.1.1' }
2026-01-23 14:30:46 [INFO] Database Query { query: 'SELECT * FROM users', duration: '12ms' }
2026-01-23 14:30:46 [INFO] Outgoing Response { method: 'POST', url: '/api/users', statusCode: 201, responseTime: '120ms' }
```

### File Log Format
```json
{
  "timestamp": "2026-01-23 14:30:45",
  "level": "INFO",
  "message": "User created successfully",
  "context": {
    "userId": "uuid-123",
    "service": "marketx-api"
  }
}
```

## Data Sanitization

The logging system automatically redacts sensitive data to prevent security breaches.

### Automatically Redacted Fields
- `password` / `passwordHash`
- `pin` / `PIN`
- `secret` / `apiSecret`
- `token` / `tokens`
- `apiKey` / `api_key`
- `authorization` / `Authorization`
- `creditCard` / `cardNumber`
- `ssn` / `socialSecurityNumber`
- `cvv` / `securityCode`
- `privateKey` / `private_key`
- `accessToken` / `access_token`
- `refreshToken` / `refresh_token`
- `jwtToken` / `jwt_token`

### Example - Before Sanitization
```json
{
  "email": "user@example.com",
  "password": "secretPassword123",
  "apiKey": "sk_live_abcd1234"
}
```

### Example - After Sanitization (What Gets Logged)
```json
{
  "email": "user@example.com",
  "password": "***REDACTED***",
  "apiKey": "***REDACTED***"
}
```

## Log Rotation and Storage

### File Structure
```
logs/
├── error-2026-01-23.log        # Errors only, 14 days retention
├── combined-2026-01-22.log     # All logs, 7 days retention
└── debug-2026-01-21.log        # Debug logs only (dev), 3 days retention
```

### Configuration

| Setting | Value | Purpose |
|---------|-------|---------|
| Max File Size | 20MB | Prevents individual log files from getting too large |
| Daily Rotation | Enabled | Creates new file each day |
| Error Retention | 14 days | Longer retention for critical errors |
| Combined Retention | 7 days | Standard retention for all logs |
| Debug Retention | 3 days | Short retention for debug logs |

## Integration Examples

### Using LoggerService in Services

```typescript
import { Injectable } from '@nestjs/common';
import { LoggerService } from '../common/logger/logger.service';

@Injectable()
export class OrderService {
  constructor(
    private logger: LoggerService,
    private orderRepository: Repository<Order>,
  ) {}

  async createOrder(createOrderDto: CreateOrderDto) {
    const startTime = Date.now();
    
    try {
      this.logger.info('Creating new order', {
        userId: createOrderDto.userId,
        itemCount: createOrderDto.items.length,
      });

      const order = await this.orderRepository.save(createOrderDto);
      
      const duration = Date.now() - startTime;
      this.logger.logPerformance('Order creation', duration, {
        orderId: order.id,
      });

      this.logger.info('Order created successfully', { orderId: order.id });
      return order;
    } catch (error) {
      this.logger.error('Failed to create order', {
        userId: createOrderDto.userId,
        error: error.message,
      }, error);
      throw error;
    }
  }

  async getOrder(orderId: string) {
    const startTime = Date.now();
    
    const order = await this.orderRepository.findOne(orderId);
    const duration = Date.now() - startTime;
    
    if (duration > 500) {
      this.logger.warn('Slow database query detected', {
        query: 'getOrder',
        duration: `${duration}ms`,
        threshold: '500ms',
      });
    }

    return order;
  }
}
```

### Logging Authentication Events

```typescript
import { Injectable } from '@nestjs/common';
import { LoggerService } from '../common/logger/logger.service';

@Injectable()
export class AuthService {
  constructor(private logger: LoggerService) {}

  async login(credentials: LoginDto) {
    try {
      const user = await this.validateUser(credentials);
      this.logger.logAuthEvent('login', user.id, {
        email: user.email,
        loginTime: new Date().toISOString(),
      });
      return this.generateToken(user);
    } catch (error) {
      this.logger.logAuthEvent('failed_login', undefined, {
        email: credentials.email,
        reason: error.message,
      });
      throw error;
    }
  }

  async logout(userId: string) {
    this.logger.logAuthEvent('logout', userId, {
      logoutTime: new Date().toISOString(),
    });
  }
}
```

### Logging Database Operations

```typescript
// In development mode, database queries are automatically logged

@Injectable()
export class ProductService {
  constructor(
    private logger: LoggerService,
    private productRepository: Repository<Product>,
  ) {}

  async findAll() {
    const startTime = Date.now();
    const products = await this.productRepository.find();
    const duration = Date.now() - startTime;

    this.logger.logDatabaseQuery(
      'SELECT * FROM products',
      [],
      duration,
    );

    return products;
  }

  async findById(id: string) {
    const startTime = Date.now();
    const product = await this.productRepository.findOne(id);
    const duration = Date.now() - startTime;

    this.logger.logDatabaseQuery(
      'SELECT * FROM products WHERE id = $1',
      [id],
      duration,
    );

    return product;
  }
}
```

## Environment Variables

Configure logging behavior with environment variables:

```bash
# Log level: error, warn, info, debug (default: info)
LOG_LEVEL=debug

# Environment: development, production (default: development)
NODE_ENV=production

# Port for application
PORT=3000
```

## Performance Monitoring

### Automatic Slow Query Detection

Requests taking longer than 1000ms are automatically flagged with a warning log:

```
2026-01-23 14:35:22 [WARN] Performance Metrics: POST /api/orders { duration: '1250ms', slow: true }
```

### Manual Performance Logging

```typescript
const startTime = Date.now();

// ... some operation

const duration = Date.now() - startTime;
this.logger.logPerformance('Complex calculation', duration, {
  itemsProcessed: 1000,
  success: true,
});
```

## Viewing Logs

### Development Environment

Logs are displayed in the console with color coding:
- 🔴 **ERROR**: Red
- 🟡 **WARN**: Yellow
- 🔵 **INFO**: Blue
- ⚪ **DEBUG**: White

### Production Environment

Logs are written to files in the `logs/` directory. Access them via:

```bash
# View current error logs
tail -f logs/error-2026-01-23.log

# View combined logs
tail -f logs/combined-2026-01-23.log

# Search for specific text
grep "user@example.com" logs/combined-*.log

# Count log entries by level
grep "\[ERROR\]" logs/combined-*.log | wc -l
```

## Best Practices

### ✅ DO

- ✅ Log at appropriate levels (error for failures, info for important events)
- ✅ Include contextual information (user ID, request ID, resource ID)
- ✅ Use structured logging with object metadata
- ✅ Log authentication and authorization events
- ✅ Log error stack traces for debugging
- ✅ Monitor performance metrics regularly

### ❌ DON'T

- ❌ Log sensitive data (passwords, tokens, keys)
- ❌ Log entire request/response bodies for large payloads
- ❌ Create excessive log files or entries
- ❌ Use console.log() directly (use LoggerService instead)
- ❌ Log at debug level in production

## Troubleshooting

### Logs Not Appearing

1. Check `LOG_LEVEL` environment variable is set correctly
2. Verify `logs/` directory has write permissions
3. Ensure LoggerService is properly injected
4. Check for errors in startup logs

### High Disk Usage

1. Reduce log retention days in LoggerService
2. Decrease max file size before rotation
3. Archive old logs to external storage
4. Disable debug logging in production

### Missing Database Query Logs

1. Database query logging only works in development mode
2. Verify `NODE_ENV` is not set to 'production'
3. Check that `LOG_LEVEL` includes 'debug'

## Integration with Log Aggregation Tools

The structured log format makes it easy to integrate with external log aggregation services:

### ELK Stack (Elasticsearch, Logstash, Kibana)
- JSON format logs can be parsed by Logstash
- Implement Logstash transport for winston

### Datadog
- Winston logs can be forwarded to Datadog
- Use Datadog winston transport

### Splunk
- HTTP Event Collector integration available
- Structured logs for better parsing

### CloudWatch (AWS)
- Winston CloudWatch transport available
- Easy setup for AWS deployments

## Future Enhancements

- [ ] Distributed tracing with correlation IDs
- [ ] Custom log aggregation dashboard
- [ ] Alert system for critical errors
- [ ] Log analytics and insights
- [ ] Request ID propagation across services
- [ ] Structured error codes for better categorization
