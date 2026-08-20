import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter, Histogram } from 'prom-client';
import { Observable } from 'rxjs';
import { catchError, finalize, throwError } from 'rxjs';

import { HTTP_REQUEST_COUNT, HTTP_REQUEST_DURATION } from './metrics.module';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(
    @InjectMetric(HTTP_REQUEST_COUNT)
    private readonly requestCounter: Counter<string>,

    @InjectMetric(HTTP_REQUEST_DURATION)
    private readonly requestDuration: Histogram<string>,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{
      method?: string;
      route?: {
        path?: string;
      };
      url?: string;
    }>();

    const response = context.switchToHttp().getResponse<{
      statusCode?: number;
    }>();

    const start = process.hrtime.bigint();

    let statusCode = 500;

    return next.handle().pipe(
      catchError((error: unknown) => {
        statusCode =
          typeof error === 'object' &&
          error !== null &&
          'status' in error &&
          typeof error.status === 'number'
            ? error.status
            : 500;

        return throwError(() => error);
      }),
      finalize(() => {
        statusCode = response.statusCode ?? statusCode;

        const duration =
          Number(process.hrtime.bigint() - start) / 1_000_000_000;

        const method = request.method ?? 'UNKNOWN';
        const route = request.route?.path ?? request.url ?? 'unknown';

        const labels = {
          method,
          route,
          status_code: String(statusCode),
        };

        this.requestCounter.inc(labels);
        this.requestDuration.observe(labels, duration);
      }),
    );
  }
}
