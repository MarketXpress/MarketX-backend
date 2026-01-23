import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

interface RateLimitConfig {
  limit: number;
  windowMs: number; // in milliseconds
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

interface ClientRecord {
  count: number;
  resetTime: number;
}

@Injectable()
export class ThrottleGuard implements CanActivate {
  private readonly logger = new Logger(ThrottleGuard.name);
  private clientRequests = new Map<string, ClientRecord>();
  private readonly defaultConfig: RateLimitConfig = {
    limit: 100,
    windowMs: 15 * 60 * 1000, // 15 minutes
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
  };

  // Custom rate limit configs for different endpoint types
  private readonly endpointConfigs: Map<string, RateLimitConfig> = new Map([
    ['auth', { limit: 5, windowMs: 15 * 60 * 1000 }], // 5 attempts per 15 minutes
    ['login', { limit: 5, windowMs: 15 * 60 * 1000 }],
    ['register', { limit: 3, windowMs: 60 * 60 * 1000 }], // 3 per hour
    ['password-reset', { limit: 3, windowMs: 60 * 60 * 1000 }],
    ['api', { limit: 100, windowMs: 15 * 60 * 1000 }], // Standard API: 100 per 15 min
    ['upload', { limit: 10, windowMs: 60 * 60 * 1000 }], // 10 uploads per hour
    ['transaction', { limit: 20, windowMs: 60 * 1000 }], // 20 per minute
    ['payment', { limit: 10, windowMs: 60 * 60 * 1000 }], // 10 per hour
  ]);

  constructor(private reflector: Reflector) {
    // Cleanup expired records every 5 minutes
    setInterval(() => this.cleanupExpiredRecords(), 5 * 60 * 1000);
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const clientId = this.getClientId(request);
    const config = this.getEndpointConfig(request.path);

    if (!clientId) {
      return true;
    }

    const now = Date.now();
    const record = this.clientRequests.get(clientId) || {
      count: 0,
      resetTime: now + config.windowMs,
    };

    // Reset if window has expired
    if (now >= record.resetTime) {
      record.count = 0;
      record.resetTime = now + config.windowMs;
    }

    // Increment request count
    record.count++;
    this.clientRequests.set(clientId, record);

    // Check if limit exceeded
    if (record.count > config.limit) {
      const retryAfter = Math.ceil((record.resetTime - now) / 1000);
      this.logger.warn(
        `Rate limit exceeded for ${clientId}. Limit: ${config.limit}, Window: ${config.windowMs}ms, Count: ${record.count}`,
      );

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Too many requests. Please try again in ${retryAfter} seconds.`,
          retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS,
        {
          cause: new Error('Rate limit exceeded'),
        },
      );
    }

    // Set response headers
    const response = context.switchToHttp().getResponse();
    response.setHeader('X-RateLimit-Limit', config.limit);
    response.setHeader('X-RateLimit-Remaining', config.limit - record.count);
    response.setHeader(
      'X-RateLimit-Reset',
      Math.ceil(record.resetTime / 1000),
    );

    return true;
  }

  private getClientId(request: Request): string {
    // Prefer user ID if authenticated, otherwise use IP
    if (request.user && typeof request.user === 'object' && 'id' in request.user) {
      return `user:${(request.user as any).id}`;
    }

    // Get client IP
    const forwarded = request.headers['x-forwarded-for'];
    const clientIp =
      (typeof forwarded === 'string' ? forwarded.split(',')[0] : forwarded?.[0]) ||
      request.ip ||
      request.socket.remoteAddress ||
      'unknown';

    return `ip:${clientIp}`;
  }

  private getEndpointConfig(path: string): RateLimitConfig {
    // Match path to endpoint type
    for (const [key, config] of this.endpointConfigs.entries()) {
      if (path.includes(key)) {
        return config;
      }
    }
    return this.defaultConfig;
  }

  private cleanupExpiredRecords(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [clientId, record] of this.clientRequests.entries()) {
      if (now >= record.resetTime) {
        this.clientRequests.delete(clientId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.debug(`Cleaned up ${cleanedCount} expired rate limit records`);
    }
  }

  /**
   * Reset rate limit for specific client (admin only)
   */
  public resetClient(clientId: string): boolean {
    return this.clientRequests.delete(clientId);
  }

  /**
   * Get current rate limit status for client
   */
  public getClientStatus(clientId: string) {
    const record = this.clientRequests.get(clientId);
    if (!record) {
      return null;
    }

    const config = this.defaultConfig;
    return {
      count: record.count,
      limit: config.limit,
      remaining: Math.max(0, config.limit - record.count),
      resetTime: record.resetTime,
      resetIn: Math.max(0, record.resetTime - Date.now()),
    };
  }
}
