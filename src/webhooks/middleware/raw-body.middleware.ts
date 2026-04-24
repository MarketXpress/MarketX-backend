import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class RawBodyMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    // Only process for webhook endpoints
    if (req.url.includes('/webhook/')) {
      let rawData = '';

      req.on('data', (chunk) => {
        rawData += chunk;
      });

      req.on('end', () => {
        (req as any).rawBody = rawData;
        next();
      });
    } else {
      next();
    }
  }
}
