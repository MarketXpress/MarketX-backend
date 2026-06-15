import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottleGuard } from './throttle.guard';
import { RATE_LIMIT_CONFIG } from '../config/rate-limit.config';

const makeContext = (ip: string, path: string, userId?: string): ExecutionContext => {
  const user = userId ? { id: userId } : undefined;
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        user,
        ip,
        path,
        headers: {},
        socket: { remoteAddress: ip },
      }),
      getResponse: () => ({
        setHeader: jest.fn(),
      }),
    }),
    getHandler: jest.fn(),
    getClass: jest.fn(),
  } as any;
};

describe('ThrottleGuard', () => {
  let guard: ThrottleGuard;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ThrottleGuard, Reflector],
    }).compile();
    guard = module.get<ThrottleGuard>(ThrottleGuard);
  });

  afterEach(() => {
    // Clear internal state between tests
    (guard as any).clientRequests.clear();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should allow requests within the default API limit', () => {
    const ctx = makeContext('1.2.3.4', '/products');
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should use LOGIN config limit for /auth/login path', () => {
    const loginLimit = RATE_LIMIT_CONFIG.LOGIN.limit;
    const ctx = makeContext('1.2.3.5', '/auth/login');

    // Exhaust the login limit
    for (let i = 0; i < loginLimit; i++) {
      expect(guard.canActivate(ctx)).toBe(true);
    }

    // Next request should be blocked
    expect(() => guard.canActivate(ctx)).toThrow(HttpException);
    try {
      guard.canActivate(ctx);
    } catch (e) {
      expect(e.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    }
  });

  it('should use PAYMENT config limit for /payments path', () => {
    const paymentLimit = RATE_LIMIT_CONFIG.PAYMENT.limit;
    const ctx = makeContext('1.2.3.6', '/payments/initiate');

    for (let i = 0; i < paymentLimit; i++) {
      expect(guard.canActivate(ctx)).toBe(true);
    }

    expect(() => guard.canActivate(ctx)).toThrow(HttpException);
  });

  it('should use TRANSACTION config limit for /transactions path', () => {
    const txLimit = RATE_LIMIT_CONFIG.TRANSACTION.limit;
    const ctx = makeContext('1.2.3.7', '/transactions/my');

    for (let i = 0; i < txLimit; i++) {
      expect(guard.canActivate(ctx)).toBe(true);
    }

    expect(() => guard.canActivate(ctx)).toThrow(HttpException);
  });

  it('should use SEARCH config limit for /search path', () => {
    const searchLimit = RATE_LIMIT_CONFIG.SEARCH.limit;
    const ctx = makeContext('1.2.3.8', '/search');

    for (let i = 0; i < searchLimit; i++) {
      expect(guard.canActivate(ctx)).toBe(true);
    }

    expect(() => guard.canActivate(ctx)).toThrow(HttpException);
  });

  it('should track authenticated users by user ID, not IP', () => {
    const ipCtx = makeContext('1.2.3.9', '/products');
    const userCtx = makeContext('1.2.3.9', '/products', 'user-abc');

    // Both should be tracked independently
    expect(guard.canActivate(ipCtx)).toBe(true);
    expect(guard.canActivate(userCtx)).toBe(true);

    const records = (guard as any).clientRequests;
    expect(records.has('ip:1.2.3.9')).toBe(true);
    expect(records.has('user:user-abc')).toBe(true);
  });

  it('should reset a specific client', () => {
    const ctx = makeContext('1.2.3.10', '/products');
    guard.canActivate(ctx);

    expect((guard as any).clientRequests.has('ip:1.2.3.10')).toBe(true);
    const result = guard.resetClient('ip:1.2.3.10');
    expect(result).toBe(true);
    expect((guard as any).clientRequests.has('ip:1.2.3.10')).toBe(false);
  });

  it('should return null status for unknown client', () => {
    expect(guard.getClientStatus('ip:unknown')).toBeNull();
  });

  it('should return status for a tracked client', () => {
    const ctx = makeContext('1.2.3.11', '/products');
    guard.canActivate(ctx);

    const status = guard.getClientStatus('ip:1.2.3.11');
    expect(status).not.toBeNull();
    expect(status!.count).toBe(1);
    expect(status!.remaining).toBeGreaterThanOrEqual(0);
  });
});
