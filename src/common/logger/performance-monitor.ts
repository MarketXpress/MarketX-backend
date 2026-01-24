import { LoggerService } from '../logger/logger.service';

/**
 * Performance Monitoring Utilities
 *
 * Provides utilities for tracking and analyzing performance metrics
 * across the application.
 */

export interface PerformanceMetrics {
  name: string;
  duration: number;
  timestamp: Date;
  tags?: Record<string, any>;
  status: 'success' | 'failure';
}

/**
 * Performance Monitor Class
 *
 * Tracks execution time of operations and logs metrics
 *
 * @example
 * const monitor = new PerformanceMonitor(logger);
 * await monitor.track('database-query', async () => {
 *   return await database.query();
 * });
 */
export class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private readonly slowThreshold: number;
  private readonly warningThreshold: number;

  constructor(
    private logger: LoggerService,
    options?: {
      slowThreshold?: number;
      warningThreshold?: number;
    },
  ) {
    this.slowThreshold = options?.slowThreshold || 1000; // ms
    this.warningThreshold = options?.warningThreshold || 500; // ms
  }

  /**
   * Track execution time of an async operation
   */
  async track<T>(
    operationName: string,
    operation: () => Promise<T>,
    tags?: Record<string, any>,
  ): Promise<T> {
    const startTime = Date.now();

    try {
      const result = await operation();
      const duration = Date.now() - startTime;

      this.recordMetric({
        name: operationName,
        duration,
        timestamp: new Date(),
        tags,
        status: 'success',
      });

      this.logDuration(operationName, duration, tags, 'success');
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      this.recordMetric({
        name: operationName,
        duration,
        timestamp: new Date(),
        tags,
        status: 'failure',
      });

      this.logger.error(
        `Performance tracking: ${operationName} failed`,
        {
          duration: `${duration}ms`,
          tags,
        },
        error,
      );

      throw error;
    }
  }

  /**
   * Track synchronous operation
   */
  trackSync<T>(
    operationName: string,
    operation: () => T,
    tags?: Record<string, any>,
  ): T {
    const startTime = Date.now();

    try {
      const result = operation();
      const duration = Date.now() - startTime;

      this.recordMetric({
        name: operationName,
        duration,
        timestamp: new Date(),
        tags,
        status: 'success',
      });

      this.logDuration(operationName, duration, tags, 'success');
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      this.recordMetric({
        name: operationName,
        duration,
        timestamp: new Date(),
        tags,
        status: 'failure',
      });

      this.logger.error(
        `Performance tracking: ${operationName} failed`,
        {
          duration: `${duration}ms`,
          tags,
        },
        error as Error,
      );

      throw error;
    }
  }

  /**
   * Measure operation using manual start/end
   */
  measure(operationName: string, tags?: Record<string, any>) {
    const startTime = Date.now();

    return {
      end: (success = true) => {
        const duration = Date.now() - startTime;

        this.recordMetric({
          name: operationName,
          duration,
          timestamp: new Date(),
          tags,
          status: success ? 'success' : 'failure',
        });

        this.logDuration(operationName, duration, tags, success ? 'success' : 'failure');
      },
    };
  }

  /**
   * Get all recorded metrics
   */
  getMetrics(): PerformanceMetrics[] {
    return [...this.metrics];
  }

  /**
   * Get metrics for a specific operation
   */
  getMetricsForOperation(operationName: string): PerformanceMetrics[] {
    return this.metrics.filter((m) => m.name === operationName);
  }

  /**
   * Get average duration for an operation
   */
  getAverageDuration(operationName: string): number {
    const operationMetrics = this.getMetricsForOperation(operationName);

    if (operationMetrics.length === 0) return 0;

    const totalDuration = operationMetrics.reduce(
      (sum, m) => sum + m.duration,
      0,
    );
    return totalDuration / operationMetrics.length;
  }

  /**
   * Get statistics for an operation
   */
  getStatistics(operationName: string) {
    const operationMetrics = this.getMetricsForOperation(operationName);

    if (operationMetrics.length === 0) {
      return null;
    }

    const durations = operationMetrics.map((m) => m.duration);
    const min = Math.min(...durations);
    const max = Math.max(...durations);
    const avg = this.getAverageDuration(operationName);
    const successCount = operationMetrics.filter(
      (m) => m.status === 'success',
    ).length;
    const failureCount = operationMetrics.filter(
      (m) => m.status === 'failure',
    ).length;

    return {
      operationName,
      count: operationMetrics.length,
      successCount,
      failureCount,
      successRate: `${((successCount / operationMetrics.length) * 100).toFixed(2)}%`,
      min: `${min}ms`,
      max: `${max}ms`,
      avg: `${avg.toFixed(2)}ms`,
      p95: `${this.calculatePercentile(durations, 95)}ms`,
      p99: `${this.calculatePercentile(durations, 99)}ms`,
    };
  }

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    this.metrics = [];
  }

  /**
   * Reset metrics for a specific operation
   */
  resetOperation(operationName: string): void {
    this.metrics = this.metrics.filter((m) => m.name !== operationName);
  }

  /**
   * Log metrics to logger
   */
  logStatistics(operationName?: string): void {
    if (operationName) {
      const stats = this.getStatistics(operationName);
      if (stats) {
        this.logger.info(
          `Performance Statistics: ${operationName}`,
          stats,
        );
      }
    } else {
      // Log all operations
      const operations = new Set(this.metrics.map((m) => m.name));
      operations.forEach((op) => {
        const stats = this.getStatistics(op);
        if (stats) {
          this.logger.info(`Performance Statistics: ${op}`, stats);
        }
      });
    }
  }

  // Private methods

  private recordMetric(metric: PerformanceMetrics): void {
    this.metrics.push(metric);

    // Keep only last 1000 metrics to prevent memory bloat
    if (this.metrics.length > 1000) {
      this.metrics.shift();
    }
  }

  private logDuration(
    operationName: string,
    duration: number,
    tags?: Record<string, any>,
    status: 'success' | 'failure' = 'success',
  ): void {
    if (duration > this.slowThreshold) {
      this.logger.warn(
        `SLOW: ${operationName} (${duration}ms > ${this.slowThreshold}ms)`,
        tags,
      );
    } else if (duration > this.warningThreshold && status === 'success') {
      this.logger.debug(
        `Performance: ${operationName} completed in ${duration}ms`,
        tags,
      );
    }
  }

  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;

    return sorted[Math.max(0, index)];
  }
}

/**
 * Batch Performance Tracker
 *
 * Useful for tracking performance of batch operations
 *
 * @example
 * const tracker = new BatchPerformanceTracker(logger);
 * tracker.start('batch-job');
 * for (let item of items) {
 *   tracker.recordItem('batch-job', item.processingTime);
 * }
 * tracker.report('batch-job');
 */
export class BatchPerformanceTracker {
  private batches: Map<string, number[]> = new Map();

  constructor(private logger: LoggerService) {}

  /**
   * Start tracking a batch
   */
  start(batchName: string): void {
    if (!this.batches.has(batchName)) {
      this.batches.set(batchName, []);
    }
  }

  /**
   * Record item processing time
   */
  recordItem(batchName: string, duration: number): void {
    if (!this.batches.has(batchName)) {
      this.batches.set(batchName, []);
    }

    this.batches.get(batchName)!.push(duration);
  }

  /**
   * Get report for a batch
   */
  report(batchName: string): any {
    const durations = this.batches.get(batchName) || [];

    if (durations.length === 0) {
      return null;
    }

    const total = durations.reduce((a, b) => a + b, 0);
    const avg = total / durations.length;
    const min = Math.min(...durations);
    const max = Math.max(...durations);

    const report = {
      batchName,
      itemCount: durations.length,
      totalTime: `${total}ms`,
      avgTime: `${avg.toFixed(2)}ms`,
      minTime: `${min}ms`,
      maxTime: `${max}ms`,
    };

    this.logger.info(`Batch Report: ${batchName}`, report);

    return report;
  }

  /**
   * Clear batch data
   */
  clear(batchName: string): void {
    this.batches.delete(batchName);
  }
}
