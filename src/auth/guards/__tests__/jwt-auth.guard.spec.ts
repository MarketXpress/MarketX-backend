import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from '../jwt-auth.guard';
import { IS_PUBLIC_KEY } from '../../decorators/public.decorator';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: jest.Mocked<Reflector>;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as any;
    guard = new JwtAuthGuard(reflector);
  });

  const createMockContext = (
    handler = () => {},
    classTarget = () => {},
  ): ExecutionContext => {
    return {
      getHandler: () => handler,
      getClass: () => classTarget,
      switchToHttp: () => ({
        getRequest: () => ({}),
        getResponse: () => ({}),
      }),
    } as any;
  };

  it('returns true if IS_PUBLIC_KEY metadata is present on route handler or class', () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    const context = createMockContext();

    const result = guard.canActivate(context);

    expect(result).toBe(true);
    expect(reflector.getAllAndOverride.mock.calls.length).toBe(1);
    expect(reflector.getAllAndOverride.mock.calls[0]).toEqual([
      IS_PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    ]);
  });

  it('proceeds with passport AuthGuard if not public', () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const context = createMockContext();
    const superCanActivateSpy = jest
      .spyOn(Object.getPrototypeOf(Object.getPrototypeOf(guard)), 'canActivate')
      .mockReturnValue(true as any);

    const result = guard.canActivate(context);

    expect(result).toBe(true);
    expect(superCanActivateSpy).toHaveBeenCalledWith(context);
    superCanActivateSpy.mockRestore();
  });

  it('handleRequest returns user if user is present', () => {
    const user = { id: 1, email: 'test@example.com' };
    expect(guard.handleRequest(null, user, null)).toBe(user);
  });

  it('handleRequest throws UnauthorizedException if user is missing', () => {
    expect(() => guard.handleRequest(null, null, null)).toThrow(
      UnauthorizedException,
    );
  });

  it('handleRequest rethrows err if error occurred', () => {
    const customErr = new Error('Token expired');
    expect(() => guard.handleRequest(customErr, null, null)).toThrow(customErr);
  });
});
