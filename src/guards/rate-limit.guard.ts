import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';
import { RateLimitService, UserTier } from '../rate-limiting/rate-limit.service';
import { RATE_LIMIT_KEY, RateLimitOptions } from '../decorators/rate-limit.decorator';

interface AuthenticatedUser {
  id?: string;
  email?: string;
  roles?: string[];
  role?: string;
  tier?: UserTier;
  subscription?: string;
}

interface RequestWithUser extends Request {
  user?: AuthenticatedUser;
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);

  constructor(
    private readonly rateLimitService: RateLimitService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const response = context.switchToHttp().getResponse<Response>();

    // Get rate limit options from decorator
    const rateLimitOptions = this.reflector.getAllAndOverride<RateLimitOptions>(
      RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Skip rate limiting if not configured or explicitly disabled
    if (!rateLimitOptions || rateLimitOptions.enabled === false) {
      return true;
    }

    try {
      // Generate identifier for rate limiting
      const identifier = this.generateIdentifier(request, rateLimitOptions);
      
      // Get user tier
      const userTier = this.getUserTier(request);
      
      // Get endpoint path
      const endpoint = this.getEndpointPath(request);
      
      // Get effective rate limit configuration
      const effectiveConfig = this.getEffectiveConfig(
        rateLimitOptions,
        userTier,
      );
      
      // Check rate limit
      const result = await this.rateLimitService.checkRateLimit(
        identifier,
        userTier,
        endpoint,
        effectiveConfig,
      );

      // Add rate limit headers to response
      this.addRateLimitHeaders(response, result.headers);

      if (!result.success) {
        this.logger.warn(
          `Rate limit exceeded for ${identifier} on ${endpoint}. ` +
            `Total hits: ${result.totalHits}, Remaining: ${result.remainingPoints}`,
        );

        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message:
              rateLimitOptions.message ||
              'Too many requests. Please try again later.',
            error: 'Too Many Requests',
            retryAfter: Math.ceil(result.msBeforeNext / 1000),
            rateLimit: {
              limit: effectiveConfig.maxRequests,
              remaining: result.remainingPoints,
              reset: new Date(Date.now() + result.msBeforeNext),
              window: effectiveConfig.windowMs,
            },
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      // Log successful rate limit check for monitoring
      if (
        effectiveConfig.maxRequests &&
        result.totalHits > effectiveConfig.maxRequests * 0.8
      ) {
        this.logger.warn(
          `Rate limit approaching for ${identifier} on ${endpoint}. ` +
            `${result.remainingPoints} requests remaining.`,
        );
      }

      return true;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Rate limit guard error:', error);
      
      // Fail open - allow request if there's an unexpected error
      // This ensures the API remains available even if rate limiting fails
      return true;
    }
  }

  /**
   * Generate unique identifier for rate limiting
   */
  private generateIdentifier(
    request: RequestWithUser,
    options: RateLimitOptions,
  ): string {
    if (options.keyGenerator) {
      return options.keyGenerator(request);
    }

    // Try to use user ID first, then IP address
    const user = request.user;
    if (user && user.id) {
      return `user:${user.id}`;
    }

    // Fallback to IP address
    const ip = this.getClientIp(request);
    return `ip:${ip}`;
  }

  /**
   * Get client IP address with support for proxies
   */
  private getClientIp(request: RequestWithUser): string {
    const forwarded = request.headers['x-forwarded-for'];
    const realIp = request.headers['x-real-ip'];
    const cfConnectingIp = request.headers['cf-connecting-ip'];
    
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    }
    
    if (typeof realIp === 'string') {
      return realIp;
    }
    
    if (typeof cfConnectingIp === 'string') {
      return cfConnectingIp;
    }
    
    return (
      request.connection?.remoteAddress ||
      request.socket?.remoteAddress ||
      '127.0.0.1'
    );
  }

  /**
   * Get user tier from request
   */
  private getUserTier(request: RequestWithUser): UserTier {
    const user = request.user;
    
    if (!user) {
      return UserTier.FREE;
    }

    // Check if user is admin
    if (user.roles?.includes('admin') || user.role === 'admin') {
      return UserTier.ADMIN;
    }

    // Check subscription tier
    if (user.tier) {
      return user.tier;
    }

    if (user.subscription) {
      switch (user.subscription.toLowerCase()) {
        case 'enterprise':
          return UserTier.ENTERPRISE;
        case 'premium':
          return UserTier.PREMIUM;
        default:
          return UserTier.FREE;
      }
    }

    return UserTier.FREE;
  }

  /**
   * Get endpoint path for rate limiting
   */
  private getEndpointPath(request: RequestWithUser): string {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const route = (request as any).route;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    return (route?.path as string) || request.path || '/';
  }

  /**
   * Get effective rate limit configuration based on user tier
   */
  private getEffectiveConfig(
    options: RateLimitOptions,
    userTier: UserTier,
  ): Partial<{
    windowMs: number;
    maxRequests: number;
    burstAllowance: number;
  }> {
    let config = {
      windowMs: options.windowMs,
      maxRequests: options.maxRequests,
      burstAllowance: options.burstAllowance,
    };

    // Apply tier-specific overrides
    if (options.tierLimits && options.tierLimits[userTier]) {
      const tierConfig = options.tierLimits[userTier];
      config = {
        windowMs: tierConfig.windowMs || config.windowMs,
        maxRequests: tierConfig.maxRequests || config.maxRequests,
        burstAllowance: tierConfig.burstAllowance || config.burstAllowance,
      };
    }

    return config;
  }

  /**
   * Add rate limit headers to response
   */
  private addRateLimitHeaders(
    response: Response,
    headers: Record<string, string>,
  ): void {
    Object.entries(headers).forEach(([key, value]) => {
      response.setHeader(key, value);
    });
  }
}
