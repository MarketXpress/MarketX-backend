import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class DynamicThrottlerGuard extends ThrottlerGuard {
  protected getLimit(context: ExecutionContext): number {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return 100; // unauthenticated
    }

    if (user.role === 'PREMIUM_SELLER') {
      return 1000;
    }

    if (user.role === 'AUTHENTICATED_USER') {
      return 300;
    }

    return 100; // fallback
  }
}
