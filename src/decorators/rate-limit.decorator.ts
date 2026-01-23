import { SetMetadata } from '@nestjs/common';
import { RateLimitConfig, UserTier } from '../rate-limiting/rate-limit.service';

export const RATE_LIMIT_KEY = 'rate_limit';

export interface RateLimitOptions {
  /**
   * Window duration in milliseconds
   */
  windowMs?: number;
  
  /**
   * Maximum number of requests allowed in the window
   */
  maxRequests?: number;
  
  /**
   * Additional requests allowed for burst traffic
   */
  burstAllowance?: number;
  
  /**
   * Whether to skip counting failed requests
   */
  skipFailedRequests?: boolean;
  
  /**
   * Whether to skip counting successful requests
   */
  skipSuccessfulRequests?: boolean;
  
  /**
   * Custom identifier function
   */
  keyGenerator?: (req: any) => string;
  
  /**
   * Different limits for different user tiers
   */
  tierLimits?: Partial<Record<UserTier, Partial<RateLimitOptions>>>;
  
  /**
   * Custom error message
   */
  message?: string;
  
  /**
   * Whether to apply rate limiting to this endpoint
   */
  enabled?: boolean;
}

/**
 * Rate limiting decorator for controllers and methods
 * 
 * @param options Rate limiting configuration options
 * 
 * @example
 * ```typescript
 * @RateLimit({
 *   windowMs: 60 * 1000, // 1 minute
 *   maxRequests: 10,
 *   burstAllowance: 2
 * })
 * @Get('profile')
 * getProfile() {
 *   return this.userService.getProfile();
 * }
 * ```
 * 
 * @example
 * ```typescript
 * // Different limits for different tiers
 * @RateLimit({
 *   windowMs: 60 * 1000,
 *   maxRequests: 5, // Default for FREE tier
 *   tierLimits: {
 *     [UserTier.PREMIUM]: { maxRequests: 20 },
 *     [UserTier.ENTERPRISE]: { maxRequests: 100 }
 *   }
 * })
 * @Post('upload')
 * uploadFile() {
 *   return this.fileService.upload();
 * }
 * ```
 */
export const RateLimit = (options: RateLimitOptions = {}) => {
  return SetMetadata(RATE_LIMIT_KEY, options);
};

/**
 * Disable rate limiting for a specific endpoint
 * 
 * @example
 * ```typescript
 * @NoRateLimit()
 * @Get('health')
 * healthCheck() {
 *   return { status: 'ok' };
 * }
 * ```
 */
export const NoRateLimit = () => {
  return SetMetadata(RATE_LIMIT_KEY, { enabled: false });
};

/**
 * Strict rate limiting for sensitive endpoints
 * 
 * @example
 * ```typescript
 * @StrictRateLimit({ maxRequests: 3, windowMs: 15 * 60 * 1000 })
 * @Post('login')
 * login() {
 *   return this.authService.login();
 * }
 * ```
 */
export const StrictRateLimit = (options: Omit<RateLimitOptions, 'burstAllowance'> = {}) => {
  return SetMetadata(RATE_LIMIT_KEY, { ...options, burstAllowance: 0 });
};

/**
 * Generous rate limiting for premium features
 * 
 * @example
 * ```typescript
 * @GenerousRateLimit({ maxRequests: 100, windowMs: 60 * 1000 })
 * @Get('premium-data')
 * getPremiumData() {
 *   return this.dataService.getPremiumData();
 * }
 * ```
 */
export const GenerousRateLimit = (options: RateLimitOptions = {}) => {
  return SetMetadata(RATE_LIMIT_KEY, { 
    ...options, 
    burstAllowance: (options.burstAllowance || 0) + Math.ceil((options.maxRequests || 10) * 0.5)
  });
};

/**
 * IP-based rate limiting (ignores user authentication)
 * 
 * @example
 * ```typescript
 * @IpRateLimit({ maxRequests: 100, windowMs: 60 * 1000 })
 * @Get('public-api')
 * getPublicData() {
 *   return this.dataService.getPublicData();
 * }
 * ```
 */
export const IpRateLimit = (options: RateLimitOptions = {}) => {
  return SetMetadata(RATE_LIMIT_KEY, { 
    ...options, 
    keyGenerator: (req) => req.ip || req.connection.remoteAddress 
  });
};

/**
 * User-based rate limiting (requires authentication)
 * 
 * @example
 * ```typescript
 * @UserRateLimit({ maxRequests: 50, windowMs: 60 * 1000 })
 * @Get('user-data')
 * getUserData() {
 *   return this.userService.getUserData();
 * }
 * ```
 */
export const UserRateLimit = (options: RateLimitOptions = {}) => {
  return SetMetadata(RATE_LIMIT_KEY, { 
    ...options, 
    keyGenerator: (req) => req.user?.id || req.user?.email || req.ip 
  });
};

/**
 * Endpoint-specific rate limiting
 * 
 * @example
 * ```typescript
 * @EndpointRateLimit({ maxRequests: 10, windowMs: 60 * 1000 })
 * @Post('sensitive-action')
 * performSensitiveAction() {
 *   return this.actionService.performAction();
 * }
 * ```
 */
export const EndpointRateLimit = (options: RateLimitOptions = {}) => {
  return SetMetadata(RATE_LIMIT_KEY, { 
    ...options, 
    keyGenerator: (req) => `${req.user?.id || req.ip}:${req.route?.path || req.url}` 
  });
};
