import { Injectable, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import { ConfigService } from '@nestjs/config';

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  burstAllowance?: number;
  skipFailedRequests?: boolean;
  skipSuccessfulRequests?: boolean;
}

export interface RateLimitResult {
  success: boolean;
  totalHits: number;
  remainingPoints: number;
  msBeforeNext: number;
  headers: Record<string, string>;
}

export enum UserTier {
  FREE = 'free',
  PREMIUM = 'premium',
  ENTERPRISE = 'enterprise',
  ADMIN = 'admin',
}

@Injectable()
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name);
  private redis: Redis;

  // Default rate limit configurations for different tiers
  private readonly tierConfigs: Record<UserTier, RateLimitConfig> = {
    [UserTier.FREE]: {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 10,
      burstAllowance: 3,
    },
    [UserTier.PREMIUM]: {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 50,
      burstAllowance: 10,
    },
    [UserTier.ENTERPRISE]: {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 200,
      burstAllowance: 50,
    },
    [UserTier.ADMIN]: {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 1000,
      burstAllowance: 200,
    },
  };

  // Endpoint-specific configurations
  private readonly endpointConfigs: Record<string, Partial<RateLimitConfig>> = {
    '/api/auth/login': {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 5,
      burstAllowance: 0,
    },
    '/api/auth/register': {
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 3,
      burstAllowance: 0,
    },
    '/api/listings': {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 30,
      burstAllowance: 5,
    },
    '/api/search': {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 20,
      burstAllowance: 3,
    },
  };

  constructor(private configService: ConfigService) {
    this.initializeRedis();
  }

  private initializeRedis() {
    const redisUrl = this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    this.redis.on('connect', () => {
      this.logger.log('Connected to Redis for rate limiting');
    });

    this.redis.on('error', (error) => {
      this.logger.error('Redis connection error:', error);
    });
  }

  /**
   * Check if a request should be rate limited using sliding window algorithm
   */
  async checkRateLimit(
    identifier: string,
    userTier: UserTier = UserTier.FREE,
    endpoint?: string,
    customConfig?: Partial<RateLimitConfig>,
  ): Promise<RateLimitResult> {
    try {
      const config = this.getRateLimitConfig(userTier, endpoint, customConfig);
      const key = this.generateKey(identifier, endpoint);
      
      const result = await this.slidingWindowRateLimit(key, config);
      
      // Log rate limit analytics
      await this.logAnalytics(identifier, endpoint || '', userTier, result);
      
      return result;
    } catch (error) {
      this.logger.error('Rate limit check failed:', error);
      // Fail open - allow request if Redis is down
      return {
        success: true,
        totalHits: 0,
        remainingPoints: 100,
        msBeforeNext: 0,
        headers: {},
      };
    }
  }

  /**
   * Sliding window rate limiting implementation
   */
  private async slidingWindowRateLimit(
    key: string,
    config: RateLimitConfig,
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - config.windowMs;
    
    const pipeline = this.redis.pipeline();
    
    // Remove expired entries
    pipeline.zremrangebyscore(key, 0, windowStart);
    
    // Count current requests in window
    pipeline.zcard(key);
    
    // Add current request
    pipeline.zadd(key, now, `${now}-${Math.random()}`);
    
    // Set expiration
    pipeline.expire(key, Math.ceil(config.windowMs / 1000));
    
    const results = await pipeline.exec();
    
    if (!results || results.some(([err]) => err)) {
      throw new Error('Redis pipeline execution failed');
    }
    
    const currentCount = (results[1][1] as number) + 1; // +1 for the current request
    const maxAllowed = config.maxRequests + (config.burstAllowance || 0);
    
    const success = currentCount <= maxAllowed;
    const remainingPoints = Math.max(0, maxAllowed - currentCount);
    const msBeforeNext = success ? 0 : config.windowMs;
    
    if (!success) {
      // Remove the request we just added since it's being rejected
      await this.redis.zrem(key, `${now}-${Math.random()}`);
    }
    
    const headers = this.generateHeaders(
      config,
      currentCount,
      remainingPoints,
      msBeforeNext,
    );
    
    return {
      success,
      totalHits: currentCount,
      remainingPoints,
      msBeforeNext,
      headers,
    };
  }

  /**
   * Get rate limit configuration based on user tier and endpoint
   */
  private getRateLimitConfig(
    userTier: UserTier,
    endpoint?: string,
    customConfig?: Partial<RateLimitConfig>,
  ): RateLimitConfig {
    let config = { ...this.tierConfigs[userTier] };
    
    // Apply endpoint-specific overrides
    if (endpoint && this.endpointConfigs[endpoint]) {
      config = { ...config, ...this.endpointConfigs[endpoint] };
    }
    
    // Apply custom overrides
    if (customConfig) {
      config = { ...config, ...customConfig };
    }
    
    return config;
  }

  /**
   * Generate Redis key for rate limiting
   */
  private generateKey(identifier: string, endpoint?: string): string {
    const parts = ['rate_limit', identifier];
    if (endpoint) {
      parts.push(endpoint.replace(/[^a-zA-Z0-9]/g, '_'));
    }
    return parts.join(':');
  }

  /**
   * Generate rate limit headers
   */
  private generateHeaders(
    config: RateLimitConfig,
    totalHits: number,
    remainingPoints: number,
    msBeforeNext: number,
  ): Record<string, string> {
    const resetTime = new Date(Date.now() + config.windowMs);
    
    return {
      'X-RateLimit-Limit': config.maxRequests.toString(),
      'X-RateLimit-Remaining': remainingPoints.toString(),
      'X-RateLimit-Reset': Math.ceil(resetTime.getTime() / 1000).toString(),
      'X-RateLimit-Window': config.windowMs.toString(),
      'X-RateLimit-Burst': (config.burstAllowance || 0).toString(),
      'Retry-After': msBeforeNext > 0 ? Math.ceil(msBeforeNext / 1000).toString() : '0',
    };
  }

  /**
   * Log rate limit analytics
   */
  private async logAnalytics(
    identifier: string,
    endpoint: string,
    userTier: UserTier,
    result: RateLimitResult,
  ): Promise<void> {
    try {
      const analyticsKey = `rate_limit_analytics:${new Date().toISOString().split('T')[0]}`;
      const data = {
        identifier,
        endpoint,
        userTier,
        success: result.success,
        totalHits: result.totalHits,
        timestamp: Date.now(),
      };
      
      await this.redis.lpush(analyticsKey, JSON.stringify(data));
      await this.redis.expire(analyticsKey, 30 * 24 * 60 * 60); // Keep for 30 days
    } catch (error) {
      this.logger.warn('Failed to log rate limit analytics:', error);
    }
  }

  /**
   * Get rate limit analytics for admin dashboard
   */
  async getAnalytics(days: number = 7): Promise<Array<{ date: string; data: any[] }>> {
    try {
      const analytics: Array<{ date: string; data: any[] }> = [];
      const today = new Date();
      
      for (let i = 0; i < days; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateKey = date.toISOString().split('T')[0];
        const analyticsKey = `rate_limit_analytics:${dateKey}`;
        
        const data = await this.redis.lrange(analyticsKey, 0, -1);
        const parsedData = data.map(item => JSON.parse(item));
        analytics.push({
          date: dateKey,
          data: parsedData,
        });
      }
      
      return analytics;
    } catch (error) {
      this.logger.error('Failed to get rate limit analytics:', error);
      return [];
    }
  }

  /**
   * Update rate limit configuration for a user tier
   */
  async updateTierConfig(tier: UserTier, config: Partial<RateLimitConfig>): Promise<void> {
    this.tierConfigs[tier] = { ...this.tierConfigs[tier], ...config };
    
    // Store in Redis for persistence across restarts
    const configKey = `rate_limit_config:tier:${tier}`;
    await this.redis.set(configKey, JSON.stringify(this.tierConfigs[tier]));
  }

  /**
   * Update rate limit configuration for an endpoint
   */
  async updateEndpointConfig(endpoint: string, config: Partial<RateLimitConfig>): Promise<void> {
    this.endpointConfigs[endpoint] = { ...this.endpointConfigs[endpoint], ...config };
    
    // Store in Redis for persistence across restarts
    const configKey = `rate_limit_config:endpoint:${endpoint}`;
    await this.redis.set(configKey, JSON.stringify(this.endpointConfigs[endpoint]));
  }

  /**
   * Load configurations from Redis on startup
   */
  async loadConfigurations(): Promise<void> {
    try {
      // Load tier configurations
      for (const tier of Object.values(UserTier)) {
        const configKey = `rate_limit_config:tier:${tier}`;
        const config = await this.redis.get(configKey);
        if (config) {
          this.tierConfigs[tier] = JSON.parse(config);
        }
      }
      
      // Load endpoint configurations
      const endpointKeys = await this.redis.keys('rate_limit_config:endpoint:*');
      for (const key of endpointKeys) {
        const endpoint = key.replace('rate_limit_config:endpoint:', '');
        const config = await this.redis.get(key);
        if (config) {
          this.endpointConfigs[endpoint] = JSON.parse(config);
        }
      }
      
      this.logger.log('Rate limit configurations loaded from Redis');
    } catch (error) {
      this.logger.warn('Failed to load rate limit configurations from Redis:', error);
    }
  }

  /**
   * Reset rate limit for a specific identifier
   */
  async resetRateLimit(identifier: string, endpoint?: string): Promise<void> {
    const key = this.generateKey(identifier, endpoint);
    await this.redis.del(key);
  }

  /**
   * Get current rate limit status for an identifier
   */
  async getRateLimitStatus(identifier: string, endpoint?: string): Promise<{
    currentCount: number;
    windowStart: Date;
    nextReset: Date;
  }> {
    const key = this.generateKey(identifier, endpoint);
    const now = Date.now();
    const windowMs = 60 * 1000; // Default window
    const windowStart = now - windowMs;
    
    await this.redis.zremrangebyscore(key, 0, windowStart);
    const currentCount = await this.redis.zcard(key);
    
    return {
      currentCount,
      windowStart: new Date(windowStart),
      nextReset: new Date(now + windowMs),
    };
  }
}
