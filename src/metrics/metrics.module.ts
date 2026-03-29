import { Module } from '@nestjs/common';
import {
  PrometheusModule,
  makeHistogramProvider,
  makeGaugeProvider,
} from '@willsoto/nestjs-prometheus';

@Module({
  imports: [
    PrometheusModule.register({
      defaultMetrics: { enabled: true },
      path: '/metrics',
    }),
  ],
  providers: [
    makeHistogramProvider({
      name: 'http_request_duration_ms',
      help: 'Duration of HTTP requests in ms',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [50, 100, 200, 300, 500, 1000, 2000, 5000],
    }),
    makeGaugeProvider({
      name: 'nodejs_heap_size_bytes',
      help: 'Node.js heap memory size in bytes',
    }),
  ],
  exports: [PrometheusModule],
})
export class MetricsModule {}
