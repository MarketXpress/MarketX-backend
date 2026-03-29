import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Histogram } from 'prom-client';
import { Observable, tap } from 'rxjs';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(
    @InjectMetric('http_request_duration_ms')
    private readonly histogram: Histogram<string>,
  ) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest();
    const end = this.histogram.startTimer({
      method: req.method,
      route: req.route?.path ?? req.url,
    });
    return next.handle().pipe(
      tap(() => {
        const res = ctx.switchToHttp().getResponse();
        end({ status_code: res.statusCode });
      }),
    );
  }
}
