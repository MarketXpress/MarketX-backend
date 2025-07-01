import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const CACHE_CONTROL_KEY = 'cache-control';

@Injectable()
export class CacheControlGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const cacheControl = this.reflector.get<string>(
      CACHE_CONTROL_KEY,
      context.getHandler()
    );

    if (!cacheControl) {
      return true;
    }

    const response = context.switchToHttp().getResponse();
    response.setHeader('Cache-Control', cacheControl);

    return true;
  }
}
