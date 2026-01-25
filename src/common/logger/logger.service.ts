import { Injectable } from '@nestjs/common';
import * as winston from 'winston';
import * as path from 'path';
import 'winston-daily-rotate-file';

interface SanitizedData {
  [key: string]: any;
}

@Injectable()
export class LoggerService {
  private logger: winston.Logger;

  constructor() {
    // Define sensitive keys that should be masked
    const SENSITIVE_KEYS = [
      'password',
      'pin',
      'secret',
      'token',
      'apiKey',
      'api_key',
      'authorization',
      'creditCard',
      'ssn',
      'cvv',
      'privateKey',
      'private_key',
      'accessToken',
      'refreshToken',
      'jwtToken',
    ];

    // Create custom format to sanitize sensitive data
    const sanitizeData = (data: any): SanitizedData => {
      if (!data) return data;

      if (typeof data !== 'object') return data;

      const sanitized = { ...data };

      const sanitizeObject = (obj: any, depth = 0): any => {
        if (depth > 10) return '[DEEP_OBJECT]';
        if (!obj || typeof obj !== 'object') return obj;

        if (Array.isArray(obj)) {
          return obj.map((item) => sanitizeObject(item, depth + 1));
        }

        const result: any = {};
        for (const [key, value] of Object.entries(obj)) {
          // Check if key matches any sensitive pattern
          const isSensitive = SENSITIVE_KEYS.some(
            (sensitiveKey) =>
              key.toLowerCase().includes(sensitiveKey.toLowerCase()),
          );

          if (isSensitive) {
            result[key] = '***REDACTED***';
          } else if (typeof value === 'object' && value !== null) {
            result[key] = sanitizeObject(value, depth + 1);
          } else {
            result[key] = value;
          }
        }
        return result;
      };

      return sanitizeObject(sanitized);
    };

    // Create custom format for logs
    const customFormat = winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      winston.format.printf(({ level, message, timestamp, ...meta }) => {
        const sanitizedMeta = sanitizeData(meta);
        const metaStr =
          Object.keys(sanitizedMeta).length > 0
            ? JSON.stringify(sanitizedMeta)
            : '';

        return `${timestamp} [${level.toUpperCase()}] ${message}${metaStr ? ' ' + metaStr : ''}`;
      }),
    );

    // Create logs directory if it doesn't exist
    const logsDir = path.join(process.cwd(), 'logs');

    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: customFormat,
      defaultMeta: { service: 'marketx-api' },
      transports: [
        // Console transport (always active)
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            customFormat,
          ),
        }),

        // Error log file - daily rotate
        new winston.transports.DailyRotateFile({
          filename: path.join(logsDir, 'error-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          level: 'error',
          maxSize: '20m',
          maxFiles: '14d',
          format: customFormat,
        }),

        // Combined log file - daily rotate
        new winston.transports.DailyRotateFile({
          filename: path.join(logsDir, 'combined-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          maxSize: '20m',
          maxFiles: '7d',
          format: customFormat,
        }),

        // Debug log file (development only)
        ...(process.env.NODE_ENV !== 'production'
          ? [
              new winston.transports.DailyRotateFile({
                filename: path.join(logsDir, 'debug-%DATE%.log'),
                datePattern: 'YYYY-MM-DD',
                level: 'debug',
                maxSize: '20m',
                maxFiles: '3d',
                format: customFormat,
              }),
            ]
          : []),
      ],
    });
  }

  /**
   * Log error level message
   */
  error(message: string, context?: any, error?: Error): void {
    this.logger.error(message, {
      context,
      stack: error?.stack,
      errorMessage: error?.message,
    });
  }

  /**
   * Log warning level message
   */
  warn(message: string, context?: any): void {
    this.logger.warn(message, { context });
  }

  /**
   * Log info level message
   */
  info(message: string, context?: any): void {
    this.logger.info(message, { context });
  }

  /**
   * Log debug level message
   */
  debug(message: string, context?: any): void {
    this.logger.debug(message, { context });
  }

  /**
   * Log API request with sanitization
   */
  logRequest(
    method: string,
    url: string,
    query?: any,
    body?: any,
    ip?: string,
  ): void {
    this.info('Incoming Request', {
      method,
      url,
      query: this.sanitizeSensitiveData(query),
      body: this.sanitizeSensitiveData(body),
      ip,
    });
  }

  /**
   * Log API response with execution time
   */
  logResponse(
    method: string,
    url: string,
    statusCode: number,
    responseTime: number,
    user?: any,
  ): void {
    this.info('Outgoing Response', {
      method,
      url,
      statusCode,
      responseTime: `${responseTime}ms`,
      userId: user?.id || 'anonymous',
    });
  }

  /**
   * Log database query (development only)
   */
  logDatabaseQuery(query: string, parameters?: any[], duration?: number): void {
    if (process.env.NODE_ENV === 'production') {
      return;
    }

    this.debug('Database Query', {
      query,
      parameters,
      duration: duration ? `${duration}ms` : undefined,
    });
  }

  /**
   * Log performance metrics
   */
  logPerformance(
    action: string,
    duration: number,
    metadata?: any,
  ): void {
    const level = duration > 1000 ? 'warn' : 'info';
    this.logger[level as keyof typeof this.logger](
      `Performance Metrics: ${action}`,
      {
        duration: `${duration}ms`,
        slow: duration > 1000,
        ...metadata,
      },
    );
  }

  /**
   * Log authentication events
   */
  logAuthEvent(
    event: 'login' | 'logout' | 'failed_login' | 'token_refresh',
    userId?: string,
    metadata?: any,
  ): void {
    this.info(`Auth Event: ${event}`, {
      userId,
      ...metadata,
    });
  }

  /**
   * Sanitize sensitive data from objects
   */
  private sanitizeSensitiveData(data: any): any {
    if (!data || typeof data !== 'object') return data;

    const SENSITIVE_KEYS = [
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
    ];

    const sanitize = (obj: any): any => {
      if (Array.isArray(obj)) {
        return obj.map((item) => sanitize(item));
      }

      if (obj !== null && typeof obj === 'object') {
        const result: any = {};
        for (const [key, value] of Object.entries(obj)) {
          const isSensitive = SENSITIVE_KEYS.some(
            (sk) => key.toLowerCase().includes(sk.toLowerCase()),
          );
          result[key] = isSensitive ? '***REDACTED***' : sanitize(value);
        }
        return result;
      }

      return obj;
    };

    return sanitize(data);
  }

  /**
   * Get logger instance for advanced usage
   */
  getLogger(): winston.Logger {
    return this.logger;
  }
}
