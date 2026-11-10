import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { UserOwnerOrAdminGuard } from '../user-owner-or-admin.guard';

describe('UserOwnerOrAdminGuard', () => {
  let guard: UserOwnerOrAdminGuard;

  beforeEach(() => {
    guard = new UserOwnerOrAdminGuard();
  });

  const createMockExecutionContext = (
    user?: any,
    params: Record<string, string> = {},
  ): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user, params }),
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
        getPattern: () => '',
      }),
      getType: () => 'http',
    } as ExecutionContext;
  };

  describe('canActivate', () => {
    it('should throw UnauthorizedException if caller is not authenticated', () => {
      const context = createMockExecutionContext(undefined, { id: '1' });
      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('should allow access if caller is admin, regardless of target id', () => {
      const context = createMockExecutionContext(
        { id: 99, role: 'admin' },
        { id: '1' },
      );
      expect(guard.canActivate(context)).toBe(true);
    });

    it('should allow access if caller is resource owner', () => {
      const context = createMockExecutionContext(
        { id: 1, role: 'user' },
        { id: '1' },
      );
      expect(guard.canActivate(context)).toBe(true);
    });

    it('should allow access if caller matches via userId property', () => {
      const context = createMockExecutionContext(
        { userId: 42, role: 'user' },
        { id: '42' },
      );
      expect(guard.canActivate(context)).toBe(true);
    });

    it('should throw ForbiddenException if caller is authenticated but neither owner nor admin', () => {
      const context = createMockExecutionContext(
        { id: 2, role: 'user' },
        { id: '1' },
      );
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if target id is missing and user is not admin', () => {
      const context = createMockExecutionContext({ id: 2, role: 'user' }, {});
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });
  });
});
