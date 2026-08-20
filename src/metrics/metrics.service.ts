import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter, Gauge, Histogram } from 'prom-client';
import { DataSource } from 'typeorm';

import {
  BULL_QUEUE_DEPTH,
  BULL_QUEUE_FAILED,
  DB_CONNECTION_STATUS,
  HTTP_REQUEST_COUNT,
  HTTP_REQUEST_DURATION,
} from './metrics.module';

@Injectable()
export class MetricsService implements OnModuleInit, OnModuleDestroy {
  private interval?: NodeJS.Timeout;

  constructor(
    private readonly dataSource: DataSource,

    @InjectMetric(DB_CONNECTION_STATUS)
    private readonly databaseStatus: Gauge<string>,

    @InjectMetric(BULL_QUEUE_DEPTH)
    private readonly queueDepth: Gauge<string>,

    @InjectMetric(BULL_QUEUE_FAILED)
    private readonly queueFailed: Counter<string>,

    @InjectMetric(HTTP_REQUEST_COUNT)
    private readonly httpRequestCount: Counter<string>,

    @InjectMetric(HTTP_REQUEST_DURATION)
    private readonly httpRequestDuration: Histogram<string>,
  ) {}

  onModuleInit(): void {
    this.interval = setInterval(() => {
      void this.collect();
    }, 15_000);

    this.interval.unref();

    void this.collect();
  }

  onModuleDestroy(): void {
    if (this.interval) {
      clearInterval(this.interval);
    }
  }

  async collect(): Promise<void> {
    await this.collectDatabaseStatus();
  }

  private async collectDatabaseStatus(): Promise<void> {
    try {
      if (!this.dataSource.isInitialized) {
        this.databaseStatus.set(0);
        return;
      }

      const result = await this.dataSource.query('SELECT 1');

      this.databaseStatus.set(result ? 1 : 0);
    } catch {
      this.databaseStatus.set(0);
    }
  }

  recordHttpRequest(
    method: string,
    route: string,
    statusCode: number,
    durationMs: number,
  ): void {
    this.httpRequestCount.inc({
      method,
      route,
      status_code: String(statusCode),
    });

    this.httpRequestDuration.observe(
      {
        method,
        route,
      },
      durationMs / 1000,
    );
  }

  setQueueDepth(queue: string, depth: number): void {
    this.queueDepth.set(
      {
        queue,
      },
      depth,
    );
  }

  recordQueueFailure(queue: string): void {
    this.queueFailed.inc({
      queue,
    });
  }
}
