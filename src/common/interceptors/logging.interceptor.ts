import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request, Response } from 'express';
import { LoggerService } from '../logger/logger.service';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private customLogger: LoggerService) {}

  intercept(context: ExecutionContext, next: any): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    const { method, url, query, body, ip } = request;
    const startTime = Date.now();

    // Log incoming request
    this.customLogger.logRequest(method, url, query, body, ip);

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        const statusCode = response.statusCode;

        // Log response
        this.customLogger.logResponse(
          method,
          url,
          statusCode,
          duration,
          (request as any).user,
        );

        // Log performance metrics if response time is high
        if (duration > 1000) {
          this.customLogger.logPerformance(
            `${method} ${url}`,
            duration,
            {
              threshold: '1000ms',
            },
          );
        }
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        this.customLogger.error(
          `Request failed: ${method} ${url}`,
          {
            duration: `${duration}ms`,
            errorMessage: error?.message,
            statusCode: error?.status || 500,
          },
          error,
        );
        throw error;
      }),
    );
  }
}
