import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { LoggerService } from '../logger/logger.service';

/**
 * Correlation ID Middleware
 *
 * Adds a unique correlation ID to each request for distributed tracing.
 * Enables tracking of requests across multiple services.
 *
 * The correlation ID is:
 * 1. Generated if not provided in headers
 * 2. Attached to all logs for this request
 * 3. Returned in response headers
 * 4. Can be passed to other services for tracing
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  constructor(private logger: LoggerService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    // Get correlation ID from headers or generate new one
    const correlationId =
      (req.headers['x-correlation-id'] as string) ||
      (req.headers['x-request-id'] as string) ||
      uuidv4();

    // Attach to request for use throughout the request lifecycle
    (req as any).correlationId = correlationId;

    // Attach to response headers
    res.setHeader('x-correlation-id', correlationId);

    // Log request start with correlation ID
    this.logger.debug('Request started', {
      correlationId,
      method: req.method,
      url: req.url,
      ip: req.ip,
    });

    // Capture the original end method
    const originalEnd = res.end;

    // Override res.end to log when response is sent
    res.end = function (...args: any[]) {
      this.logger.debug('Request completed', {
        correlationId,
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
      });

      return originalEnd.apply(res, args);
    };

    next();
  }
}

/**
 * Helper class for correlation ID management
 *
 * Use this to pass correlation ID to other services
 */
export class CorrelationIdHelper {
  /**
   * Get correlation ID from Express request
   */
  static getFromRequest(req: Request): string {
    return (req as any).correlationId || 'unknown';
  }

  /**
   * Create headers with correlation ID for external service calls
   */
  static createHeaders(correlationId: string): Record<string, string> {
    return {
      'x-correlation-id': correlationId,
      'x-request-id': correlationId,
    };
  }
}
