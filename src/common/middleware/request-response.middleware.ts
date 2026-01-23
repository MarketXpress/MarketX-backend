import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { LoggerService } from '../logger/logger.service';

@Injectable()
export class RequestResponseMiddleware implements NestMiddleware {
  constructor(private customLogger: LoggerService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const startTime = Date.now();
    const { method, url, query, body, ip, headers } = req;

    // Override res.json to capture response
    const originalJson = res.json.bind(res);
    let responseBody: any;

    res.json = function (data: any) {
      responseBody = data;
      return originalJson(data);
    };

    // Log on response finish
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const statusCode = res.statusCode;

      // Skip logging for health checks and static assets
      if (this.shouldSkipLogging(url)) {
        return;
      }

      const logData = {
        method,
        url,
        statusCode,
        duration: `${duration}ms`,
        ip,
        userAgent: headers['user-agent'],
        userId: (req as any).user?.id || 'anonymous',
      };

      // Log based on status code
      if (statusCode >= 500) {
        this.customLogger.error(
          `Server Error: ${method} ${url}`,
          logData,
        );
      } else if (statusCode >= 400) {
        this.customLogger.warn(
          `Client Error: ${method} ${url}`,
          logData,
        );
      } else {
        this.customLogger.info(
          `Request completed: ${method} ${url}`,
          logData,
        );
      }
    });

    next();
  }

  private shouldSkipLogging(url: string): boolean {
    // Skip logging for certain endpoints
    const skipPatterns = [
      '/health',
      '/ping',
      '/metrics',
      '/swagger',
      '/docs',
      '.js',
      '.css',
      '.png',
      '.jpg',
      '.gif',
      '.ico',
    ];

    return skipPatterns.some((pattern) => url.includes(pattern));
  }
}
