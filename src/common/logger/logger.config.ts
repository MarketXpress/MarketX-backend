/**
 * Winston Logger Configuration Reference
 *
 * This file documents the Winston configuration used in the LoggerService.
 * It serves as a reference for understanding and customizing logging behavior.
 */

import * as path from 'path';

/**
 * Log Levels Configuration
 *
 * Winston uses the following severity levels:
 * 0 = error   - Fatal error conditions
 * 1 = warn    - Warning conditions
 * 2 = info    - Informational messages
 * 3 = http    - HTTP requests
 * 4 = verbose - Verbose output
 * 5 = debug   - Debug-level messages
 * 6 = silly   - Very detailed output
 *
 * Default level is 'info', which shows info and above (error, warn, info)
 */

/**
 * Transports Configuration
 *
 * Console Transport:
 * - Always active in development and production
 * - Provides real-time visibility
 * - Colored output in development
 *
 * Daily Rotate File Transport:
 * - Error logs: 14 days retention
 * - Combined logs: 7 days retention
 * - Debug logs (dev only): 3 days retention
 */

/**
 * Sensitive Data Redaction
 *
 * The following fields are automatically masked with '***REDACTED***':
 *
 * Authentication Related:
 * - password, passwordHash
 * - token, tokens
 * - secret, apiSecret
 * - authorization, Authorization
 * - privateKey, private_key
 *
 * Payment Related:
 * - creditCard, cardNumber
 * - cvv, securityCode
 * - pin, PIN
 *
 * API Keys:
 * - apiKey, api_key
 * - accessToken, access_token
 * - refreshToken, refresh_token
 * - jwtToken, jwt_token
 *
 * Custom fields can be added in LoggerService.sanitizeData()
 */

/**
 * Log Format Example
 *
 * Timestamp: YYYY-MM-DD HH:mm:ss
 * Level: ERROR, WARN, INFO, DEBUG
 * Message: Description of the event
 * Meta: Contextual information as JSON
 *
 * Example Output:
 * 2026-01-23 14:30:45 [INFO] User created successfully { userId: 'abc123', email: 'user@example.com' }
 */

/**
 * Performance Monitoring Thresholds
 *
 * - Slow Request Threshold: 1000ms
 * - Requests exceeding this threshold are logged as WARN level
 * - Useful for identifying performance bottlenecks
 */

/**
 * File Rotation Configuration
 *
 * Pattern: YYYY-MM-DD (Daily rotation)
 * Max Size: 20MB (prevents individual files from being too large)
 * Max Days: Varies by log type (see above)
 *
 * File Location: ./logs/ (relative to application root)
 */

/**
 * Environment-Specific Behavior
 *
 * Development (NODE_ENV !== 'production'):
 * - All log levels are processed
 * - Debug logs are created
 * - Stack traces are included in responses
 * - Detailed error information is logged
 *
 * Production (NODE_ENV === 'production'):
 * - Debug logs are disabled
 * - Sensitive error details are hidden from clients
 * - Only critical information is logged
 * - Performance optimizations are active
 */

/**
 * Integration Points
 *
 * The logging system integrates with:
 * 1. Global Exception Filter - catches all errors
 * 2. Logging Interceptor - tracks requests/responses
 * 3. Request/Response Middleware - low-level tracking
 * 4. Services - explicit logging for business logic
 */

/**
 * Metrics Collection
 *
 * Currently tracked metrics:
 * - Request count and duration
 * - Error frequency and type
 * - Authentication events (login, logout, failures)
 * - Database query performance
 * - API response times
 *
 * Future enhancements:
 * - Distributed tracing with correlation IDs
 * - Aggregated metrics dashboard
 * - Alert system for anomalies
 */

/**
 * Custom Transport Example
 *
 * To add a custom transport (e.g., Datadog, ELK, CloudWatch):
 *
 * ```typescript
 * import * as Datadog from 'winston-datadog-transport';
 *
 * // Add to logger.createLogger() transports array:
 * new Datadog.DatadogTransport({
 *   apiKey: process.env.DATADOG_API_KEY,
 *   host: 'localhost',
 *   port: 10516,
 * })
 * ```
 */

/**
 * Querying Logs
 *
 * Development:
 * - Check console output directly
 * - Use `tail -f logs/combined-*.log` for real-time monitoring
 * - Use `grep` for searching specific entries
 *
 * Production:
 * - Forward logs to centralized log management system
 * - Use log aggregation tool UI for searching
 * - Set up alerts for error conditions
 */

/**
 * Best Practices
 *
 * 1. Use appropriate log levels
 *    - ERROR for failures
 *    - WARN for suspicious activity
 *    - INFO for important events
 *    - DEBUG for troubleshooting
 *
 * 2. Include context in logs
 *    - User ID, Request ID, Resource ID
 *    - Operation name and status
 *    - Relevant metrics
 *
 * 3. Never log sensitive data
 *    - Passwords, tokens, keys
 *    - Credit card information
 *    - Social security numbers
 *    - Personal identifiable information
 *
 * 4. Keep logs manageable
 *    - Don't log entire request/response bodies
 *    - Use structured logging (objects)
 *    - Set appropriate retention periods
 *
 * 5. Monitor log file size
 *    - Check disk space regularly
 *    - Archive old logs if needed
 *    - Implement log cleanup processes
 */

export const loggerConfig = {
  logDir: path.join(process.cwd(), 'logs'),
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
  },
  transports: {
    console: {
      enabled: true,
      level: process.env.LOG_LEVEL || 'info',
    },
    errorFile: {
      enabled: true,
      filename: 'error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '20m',
      maxDays: '14d',
    },
    combinedFile: {
      enabled: true,
      filename: 'combined-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxDays: '7d',
    },
    debugFile: {
      enabled: process.env.NODE_ENV !== 'production',
      filename: 'debug-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'debug',
      maxSize: '20m',
      maxDays: '3d',
    },
  },
  sensitiveFields: [
    'password',
    'pin',
    'secret',
    'token',
    'apiKey',
    'authorization',
    'creditCard',
    'ssn',
    'cvv',
    'privateKey',
    'accessToken',
    'refreshToken',
    'jwtToken',
  ],
  performance: {
    slowRequestThreshold: 1000, // milliseconds
    slowQueryThreshold: 500, // milliseconds
  },
};
