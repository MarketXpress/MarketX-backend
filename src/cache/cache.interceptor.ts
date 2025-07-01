import { 
  Injectable, 
  NestInterceptor, 
  ExecutionContext, 
  CallHandler 
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import { CacheManagerService } from './cache-manager.service';
import { CACHEABLE_KEY } from '../decorators/cacheable.decorator';

@Injectable()
export class CacheInterceptor implements NestInterceptor {
  constructor(
    private readonly cacheManager: CacheManagerService,
    private readonly reflector: Reflector
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const cacheConfig = this.reflector.get(CACHEABLE_KEY, context.getHandler());
    
    if (!cacheConfig) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const cacheKey = this.generateCacheKey(request, cacheConfig);

    return new Observable(observer => {
      this.cacheManager.getOrSet(
        cacheKey,
        () => next.handle().toPromise(),
        cacheConfig
      ).then(
        result => {
          observer.next(result);
          observer.complete();
        },
        error => observer.error(error)
      );
    });
  }

  private generateCacheKey(request: any, config: any): string {
    const { method, url, user } = request;
    const userId = user?.id || 'anonymous';
    const queryParams = new URLSearchParams(request.query).toString();
    
    return `${method}:${url}:${userId}:${queryParams}`;
  }
}
