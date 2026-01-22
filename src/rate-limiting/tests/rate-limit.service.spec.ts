import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RateLimitService, UserTier } from '../rate-limit.service';
import Redis from 'ioredis';

// Mock Redis
jest.mock('ioredis');

describe('RateLimitService', () => {
  let service: RateLimitService;
  let mockRedis: jest.Mocked<Redis>;

  beforeEach(async () => {
    const mockConfigService = {
      get: jest.fn().mockReturnValue('redis://localhost:6379'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RateLimitService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<RateLimitService>(RateLimitService);
    
    // Get the mocked Redis instance
    mockRedis = require('ioredis').mocked();
    mockRedis.pipeline = jest.fn().mockReturnValue({
      zremrangebyscore: jest.fn().mockReturnThis(),
      zcard: jest.fn().mockReturnThis(),
      zadd: jest.fn().mockReturnThis(),
      expire: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([
        [null, 0], // zremrangebyscore
        [null, 2], // zcard
        [null, 1], // zadd
        [null, 1], // expire
      ]),
    });
    mockRedis.zrem = jest.fn().mockResolvedValue(1);
    mockRedis.del = jest.fn().mockResolvedValue(1);
    mockRedis.zcard = jest.fn().mockResolvedValue(2);
    mockRedis.zremrangebyscore = jest.fn().mockResolvedValue(1);
    mockRedis.lpush = jest.fn().mockResolvedValue(1);
    mockRedis.expire = jest.fn().mockResolvedValue(1);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('checkRateLimit', () => {
    it('should allow request when under limit', async () => {
      const result = await service.checkRateLimit('test-user', UserTier.FREE);
      
      expect(result.success).toBe(true);
      expect(result.totalHits).toBe(3); // Based on mocked zcard + 1
      expect(result.remainingPoints).toBeGreaterThan(0);
    });

    it('should block request when over limit', async () => {
      // Mock higher count to exceed limit
      mockRedis.pipeline().exec = jest.fn().mockResolvedValue([
        [null, 0], // zremrangebyscore
        [null, 15], // zcard (exceeds FREE tier limit of 10 + 3 burst)
        [null, 1], // zadd
        [null, 1], // expire
      ]);

      const result = await service.checkRateLimit('test-user', UserTier.FREE);
      
      expect(result.success).toBe(false);
      expect(result.totalHits).toBe(16);
      expect(result.remainingPoints).toBe(0);
    });

    it('should apply different limits for different tiers', async () => {
      const freeResult = await service.checkRateLimit('free-user', UserTier.FREE);
      const premiumResult = await service.checkRateLimit('premium-user', UserTier.PREMIUM);
      
      // Both should succeed with same request count, but premium has higher limits
      expect(freeResult.success).toBe(true);
      expect(premiumResult.success).toBe(true);
      
      // Premium should have more remaining points
      expect(premiumResult.remainingPoints).toBeGreaterThan(freeResult.remainingPoints);
    });

    it('should apply endpoint-specific limits', async () => {
      const result = await service.checkRateLimit(
        'test-user',
        UserTier.FREE,
        '/api/auth/login'
      );
      
      expect(result.success).toBe(true);
      // Login endpoint has stricter limits
      expect(result.headers['X-RateLimit-Limit']).toBe('5');
    });

    it('should fail open when Redis is unavailable', async () => {
      mockRedis.pipeline().exec = jest.fn().mockRejectedValue(new Error('Redis unavailable'));

      const result = await service.checkRateLimit('test-user', UserTier.FREE);
      
      expect(result.success).toBe(true);
      expect(result.totalHits).toBe(0);
    });
  });

  describe('resetRateLimit', () => {
    it('should reset rate limit for identifier', async () => {
      await service.resetRateLimit('test-user');
      
      expect(mockRedis.del).toHaveBeenCalledWith('rate_limit:test-user');
    });

    it('should reset rate limit for identifier and endpoint', async () => {
      await service.resetRateLimit('test-user', '/api/listings');
      
      expect(mockRedis.del).toHaveBeenCalledWith('rate_limit:test-user:_api_listings');
    });
  });

  describe('getRateLimitStatus', () => {
    it('should return current status', async () => {
      const status = await service.getRateLimitStatus('test-user');
      
      expect(status.currentCount).toBe(2);
      expect(status.windowStart).toBeInstanceOf(Date);
      expect(status.nextReset).toBeInstanceOf(Date);
    });
  });

  describe('updateTierConfig', () => {
    it('should update tier configuration', async () => {
      mockRedis.set = jest.fn().mockResolvedValue('OK');
      
      await service.updateTierConfig(UserTier.FREE, {
        maxRequests: 20,
        windowMs: 120000,
      });
      
      expect(mockRedis.set).toHaveBeenCalledWith(
        'rate_limit_config:tier:free',
        expect.stringContaining('20')
      );
    });
  });

  describe('updateEndpointConfig', () => {
    it('should update endpoint configuration', async () => {
      mockRedis.set = jest.fn().mockResolvedValue('OK');
      
      await service.updateEndpointConfig('/api/test', {
        maxRequests: 5,
        windowMs: 300000,
      });
      
      expect(mockRedis.set).toHaveBeenCalledWith(
        'rate_limit_config:endpoint:/api/test',
        expect.stringContaining('5')
      );
    });
  });

  describe('getAnalytics', () => {
    it('should return analytics data', async () => {
      mockRedis.lrange = jest.fn().mockResolvedValue([
        JSON.stringify({
          identifier: 'user:123',
          endpoint: '/api/listings',
          userTier: 'premium',
          success: true,
          totalHits: 5,
          timestamp: Date.now(),
        }),
      ]);

      const analytics = await service.getAnalytics(1);
      
      expect(analytics).toHaveLength(1);
      expect(analytics[0].data).toHaveLength(1);
      expect(analytics[0].data[0].identifier).toBe('user:123');
    });
  });
});
