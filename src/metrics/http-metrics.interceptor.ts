import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, finalize } from 'rxjs';

import { MetricsService } from './metrics.service';

@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();

    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const start = process.hrtime.bigint();

    return next.handle().pipe(
      finalize(() => {
        const durationNanoseconds = process.hrtime.bigint() - start;
        const durationSeconds = Number(durationNanoseconds) / 1_000_000_000;

        const route =
          request.route?.path ||
          request.route?.stack?.[0]?.route?.path ||
          request.path ||
          'unknown';

        this.metrics.recordHttpRequest(
          request.method,
          route,
          response.statusCode,
          durationSeconds,
        );
      }),
    );
  }
}
