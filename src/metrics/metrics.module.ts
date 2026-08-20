import { Module } from '@nestjs/common';
import {
  PrometheusModule,
  makeCounterProvider,
  makeGaugeProvider,
  makeHistogramProvider,
} from '@willsoto/nestjs-prometheus';

// import { MetricsController } from './metrics.controller';
// import { MetricsInterceptor } from './metrics.interceptor';
import { MetricsController } from './metrics.controller';
import { MetricsInterceptor } from './metrics.interceptor';
import { MetricsService } from './metrics.service';

export const HTTP_REQUEST_COUNT = 'marketx_http_requests_total';
export const HTTP_REQUEST_DURATION = 'marketx_http_request_duration_seconds';
export const DB_CONNECTION_STATUS = 'marketx_database_connection_status';
export const BULL_QUEUE_DEPTH = 'marketx_bull_queue_depth';
export const BULL_QUEUE_FAILED = 'marketx_bull_queue_failed_total';

@Module({
  imports: [
    PrometheusModule.register({
      path: '/metrics',
      defaultMetrics: {
        enabled: true,
      },
    }),
  ],
  controllers: [MetricsController],
  providers: [
    MetricsService,
    MetricsInterceptor,

    makeCounterProvider({
      name: HTTP_REQUEST_COUNT,
      help: 'Total number of HTTP requests handled by the application.',
      labelNames: ['method', 'route', 'status_code'],
    }),

    makeHistogramProvider({
      name: HTTP_REQUEST_DURATION,
      help: 'HTTP request duration in seconds.',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    }),

    makeGaugeProvider({
      name: DB_CONNECTION_STATUS,
      help: 'Database connectivity status.',
    }),

    makeGaugeProvider({
      name: BULL_QUEUE_DEPTH,
      help: 'Number of waiting jobs in Bull queues.',
      labelNames: ['queue'],
    }),

    makeCounterProvider({
      name: BULL_QUEUE_FAILED,
      help: 'Total number of failed Bull queue jobs.',
      labelNames: ['queue'],
    }),
  ],
  exports: [PrometheusModule, MetricsService, MetricsInterceptor],
})
export class MetricsModule {}
