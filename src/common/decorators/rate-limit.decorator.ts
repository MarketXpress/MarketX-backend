import { SetMetadata } from '@nestjs/common';
import { RATE_LIMIT_CONFIG } from '../config/rate-limit.config';

/**
 * Rate limit decorator to apply specific rate limits to endpoints
 * Usage: @RateLimit('AUTH') or @RateLimit('API', { limit: 50, windowMs: 60000 })
 */
export const RATE_LIMIT_KEY = 'rate_limit';

export const RateLimit = (
  type: keyof typeof RATE_LIMIT_CONFIG | 'CUSTOM',
  customConfig?: { limit: number; windowMs: number },
) =>
  SetMetadata(RATE_LIMIT_KEY, {
    type,
    config: customConfig || RATE_LIMIT_CONFIG[type] || RATE_LIMIT_CONFIG.API,
  });

/**
 * Skip rate limiting for specific endpoints
 * Usage: @SkipRateLimit()
 */
export const SKIP_RATE_LIMIT_KEY = 'skip_rate_limit';

export const SkipRateLimit = () => SetMetadata(SKIP_RATE_LIMIT_KEY, true);

/**
 * Public endpoint - no authentication required but still rate limited
 * Usage: @Public()
 */
export const PUBLIC_KEY = 'public';

export const Public = () => SetMetadata(PUBLIC_KEY, true);

/**
 * Admin-only endpoint with different rate limits
 * Usage: @AdminOnly()
 */
export const ADMIN_ONLY_KEY = 'admin_only';

export const AdminOnly = () => SetMetadata(ADMIN_ONLY_KEY, true);
