import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RateLimitGuard } from '../rate-limit.guard';
import { RateLimitService, UserTier } from '../../rate-limiting/rate-limit.service';
import { RATE_LIMIT_KEY, RateLimitOptions } from '../../decorators/rate-limit.decorator';

describe('RateLimitGuard', () => {
  let guard: RateLimitGuard;
  let rateLimitService: jest.Mocked<RateLimitService>;
  let reflector: jest.Mocked<Reflector>;

  beforeEach(async () => {
    const mockRateLimitService = {
      checkRateLimit: jest.fn(),
    };

    const mockReflector = {
      getAllAndOverride: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RateLimitGuard,
        {
          provide: RateLimitService,
          useValue: mockRateLimitService,
        },
        {
          provide: Reflector,
          useValue: mockReflector,
        },
      ],
    }).compile();

    guard = module.get<RateLimitGuard>(RateLimitGuard);
    rateLimitService = module.get(RateLimitService);
    reflector = module.get(Reflector);
  });

  const createMockContext = (user?: any, ip = '127.0.0.1', path = '/api/test'): ExecutionContext => {
    const request = {
      user,
      ip,
      path,
      route: { path },
      headers: {},
      connection: { remoteAddress: ip },
    };

    const response = {
      setHeader: jest.fn(),
    };

    return {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as any;
  };

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should allow request when no rate limit decorator is present', async () => {
    reflector.getAllAndOverride.mockReturnValue(null);
    const context = createMockContext();

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(rateLimitService.checkRateLimit).not.toHaveBeenCalled();
  });

  it('should allow request when rate limiting is explicitly disabled', async () => {
    reflector.getAllAndOverride.mockReturnValue({ enabled: false });
    const context = createMockContext();

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(rateLimitService.checkRateLimit).not.toHaveBeenCalled();
  });

  it('should allow request when under rate limit', async () => {
    const rateLimitOptions: RateLimitOptions = {
      windowMs: 60000,
      maxRequests: 10,
    };
    
    reflector.getAllAndOverride.mockReturnValue(rateLimitOptions);
    rateLimitService.checkRateLimit.mockResolvedValue({
      success: true,
      totalHits: 5,
      remainingPoints: 5,
      msBeforeNext: 0,
      headers: {
        'X-RateLimit-Limit': '10',
        'X-RateLimit-Remaining': '5',
        'X-RateLimit-Reset': '1234567890',
      },
    });

    const context = createMockContext();
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(rateLimitService.checkRateLimit).toHaveBeenCalledWith(
      'ip:127.0.0.1',
      UserTier.FREE,
      '/api/test',
      { windowMs: 60000, maxRequests: 10 }
    );
  });

  it('should block request when over rate limit', async () => {
    const rateLimitOptions: RateLimitOptions = {
      windowMs: 60000,
      maxRequests: 10,
      message: 'Custom rate limit message',
    };
    
    reflector.getAllAndOverride.mockReturnValue(rateLimitOptions);
    rateLimitService.checkRateLimit.mockResolvedValue({
      success: false,
      totalHits: 15,
      remainingPoints: 0,
      msBeforeNext: 30000,
      headers: {
        'X-RateLimit-Limit': '10',
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': '1234567890',
        'Retry-After': '30',
      },
    });

    const context = createMockContext();

    await expect(guard.canActivate(context)).rejects.toThrow(HttpException);
    
    try {
      await guard.canActivate(context);
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect(error.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      expect(error.getResponse()).toMatchObject({
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message: 'Custom rate limit message',
        error: 'Too Many Requests',
        retryAfter: 30,
      });
    }
  });

  it('should use user ID when user is authenticated', async () => {
    const rateLimitOptions: RateLimitOptions = {
      windowMs: 60000,
      maxRequests: 10,
    };
    
    reflector.getAllAndOverride.mockReturnValue(rateLimitOptions);
    rateLimitService.checkRateLimit.mockResolvedValue({
      success: true,
      totalHits: 5,
      remainingPoints: 5,
      msBeforeNext: 0,
      headers: {},
    });

    const context = createMockContext({ id: '123', email: 'test@example.com' });
    await guard.canActivate(context);

    expect(rateLimitService.checkRateLimit).toHaveBeenCalledWith(
      'user:123',
      UserTier.FREE,
      '/api/test',
      { windowMs: 60000, maxRequests: 10 }
    );
  });

  it('should detect admin user tier', async () => {
    const rateLimitOptions: RateLimitOptions = {
      windowMs: 60000,
      maxRequests: 10,
    };
    
    reflector.getAllAndOverride.mockReturnValue(rateLimitOptions);
    rateLimitService.checkRateLimit.mockResolvedValue({
      success: true,
      totalHits: 5,
      remainingPoints: 5,
      msBeforeNext: 0,
      headers: {},
    });

    const context = createMockContext({ id: '123', roles: ['admin'] });
    await guard.canActivate(context);

    expect(rateLimitService.checkRateLimit).toHaveBeenCalledWith(
      'user:123',
      UserTier.ADMIN,
      '/api/test',
      { windowMs: 60000, maxRequests: 10 }
    );
  });

  it('should detect premium user tier', async () => {
    const rateLimitOptions: RateLimitOptions = {
      windowMs: 60000,
      maxRequests: 10,
    };
    
    reflector.getAllAndOverride.mockReturnValue(rateLimitOptions);
    rateLimitService.checkRateLimit.mockResolvedValue({
      success: true,
      totalHits: 5,
      remainingPoints: 5,
      msBeforeNext: 0,
      headers: {},
    });

    const context = createMockContext({ id: '123', subscription: 'premium' });
    await guard.canActivate(context);

    expect(rateLimitService.checkRateLimit).toHaveBeenCalledWith(
      'user:123',
      UserTier.PREMIUM,
      '/api/test',
      { windowMs: 60000, maxRequests: 10 }
    );
  });

  it('should use custom key generator when provided', async () => {
    const rateLimitOptions: RateLimitOptions = {
      windowMs: 60000,
      maxRequests: 10,
      keyGenerator: (req) => `custom:${req.user?.id || req.ip}`,
    };
    
    reflector.getAllAndOverride.mockReturnValue(rateLimitOptions);
    rateLimitService.checkRateLimit.mockResolvedValue({
      success: true,
      totalHits: 5,
      remainingPoints: 5,
      msBeforeNext: 0,
      headers: {},
    });

    const context = createMockContext({ id: '123' });
    await guard.canActivate(context);

    expect(rateLimitService.checkRateLimit).toHaveBeenCalledWith(
      'custom:123',
      UserTier.FREE,
      '/api/test',
      { windowMs: 60000, maxRequests: 10 }
    );
  });

  it('should apply tier-specific limits', async () => {
    const rateLimitOptions: RateLimitOptions = {
      windowMs: 60000,
      maxRequests: 10,
      tierLimits: {
        [UserTier.PREMIUM]: { maxRequests: 50 },
        [UserTier.ENTERPRISE]: { maxRequests: 200 },
      },
    };
    
    reflector.getAllAndOverride.mockReturnValue(rateLimitOptions);
    rateLimitService.checkRateLimit.mockResolvedValue({
      success: true,
      totalHits: 5,
      remainingPoints: 45,
      msBeforeNext: 0,
      headers: {},
    });

    const context = createMockContext({ id: '123', subscription: 'premium' });
    await guard.canActivate(context);

    expect(rateLimitService.checkRateLimit).toHaveBeenCalledWith(
      'user:123',
      UserTier.PREMIUM,
      '/api/test',
      { windowMs: 60000, maxRequests: 50 }
    );
  });

  it('should handle client IP from various headers', async () => {
    const rateLimitOptions: RateLimitOptions = {
      windowMs: 60000,
      maxRequests: 10,
    };
    
    reflector.getAllAndOverride.mockReturnValue(rateLimitOptions);
    rateLimitService.checkRateLimit.mockResolvedValue({
      success: true,
      totalHits: 5,
      remainingPoints: 5,
      msBeforeNext: 0,
      headers: {},
    });

    // Test X-Forwarded-For header
    const request = {
      user: null,
      ip: '127.0.0.1',
      path: '/api/test',
      route: { path: '/api/test' },
      headers: { 'x-forwarded-for': '192.168.1.1, 10.0.0.1' },
      connection: { remoteAddress: '127.0.0.1' },
    };

    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => ({ setHeader: jest.fn() }),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as any;

    await guard.canActivate(context);

    expect(rateLimitService.checkRateLimit).toHaveBeenCalledWith(
      'ip:192.168.1.1',
      UserTier.FREE,
      '/api/test',
      { windowMs: 60000, maxRequests: 10 }
    );
  });

  it('should fail open when rate limit service throws unexpected error', async () => {
    const rateLimitOptions: RateLimitOptions = {
      windowMs: 60000,
      maxRequests: 10,
    };
    
    reflector.getAllAndOverride.mockReturnValue(rateLimitOptions);
    rateLimitService.checkRateLimit.mockRejectedValue(new Error('Unexpected error'));

    const context = createMockContext();
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
  });
});
