import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { CacheService } from '../cache.service';

@Injectable()
export class CacheMiddleware implements NestMiddleware {
  constructor(private readonly cacheService: CacheService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    if (req.method !== 'GET') {
      return next();
    }

    const cacheKey = this.generateCacheKey(req);
    const cached = await this.cacheService.get(cacheKey);

    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(cached);
    }

    res.setHeader('X-Cache', 'MISS');
    
    const originalJson = res.json;
    res.json = function(data) {
      this.cacheService.set(cacheKey, data, { ttl: 300 });
      return originalJson.call(this, data);
    }.bind({ cacheService: this.cacheService });

    next();
  }

  private generateCacheKey(req: Request): string {
    const { method, originalUrl, user } = req as any;
    const userId = user?.id || 'anonymous';
    return `middleware:${method}:${originalUrl}:${userId}`;
  }
}
