import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminGuard } from '../admin.guard';

describe('AdminGuard', () => {
  let guard: AdminGuard;
  let reflector: Reflector;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminGuard,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<AdminGuard>(AdminGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  const createMockExecutionContext = (user?: any): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
        getResponse: () => ({}),
        getNext: () => jest.fn(),
      }),
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
      getArgs: () => [],
      getArgByIndex: () => ({}),
      switchToRpc: () => ({
        getData: () => ({}),
        getContext: () => ({}),
      }),
      switchToWs: () => ({
        getData: () => ({}),
        getClient: () => ({}),
      }),
      getType: () => 'http',
    } as ExecutionContext;
  };

  describe('canActivate', () => {
    it('should allow access for admin users', () => {
      const context = createMockExecutionContext({
        id: 1,
        email: 'admin@example.com',
        role: 'admin',
      });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should deny access for non-admin users', () => {
      const context = createMockExecutionContext({
        id: 2,
        email: 'user@example.com',
        role: 'user',
      });

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('should deny access for moderator users', () => {
      const context = createMockExecutionContext({
        id: 3,
        email: 'moderator@example.com',
        role: 'moderator',
      });

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('should throw UnauthorizedException when no user is present', () => {
      const context = createMockExecutionContext(null);

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when user is undefined', () => {
      const context = createMockExecutionContext(undefined);

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('should deny access when user has no role property', () => {
      const context = createMockExecutionContext({
        id: 4,
        email: 'norole@example.com',
        // No role property
      });

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('should deny access when user role is null', () => {
      const context = createMockExecutionContext({
        id: 5,
        email: 'nullrole@example.com',
        role: null,
      });

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });
  });
});
