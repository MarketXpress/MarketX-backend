import { Injectable, Logger } from '@nestjs/common';
import { WEBHOOK_METRICS_KEY } from '../constants/webhook.constants';
import { RedisCacheService } from '../../redis-caching/redis-cache.service';

export interface WebhookMetrics {
  totalVerifications: number;
  successfulVerifications: number;
  failedVerifications: number;
  averageVerificationTime: number;
  lastVerificationAt: Date;
  verificationFailures: {
    signature: number;
    timestamp: number;
    nonce: number;
    other: number;
  };
}

@Injectable()
export class WebhooksMetricsService {
  private readonly logger = new Logger(WebhooksMetricsService.name);

  constructor(private readonly redisCache: RedisCacheService) {}

  async recordVerification(success: boolean, duration: number): Promise<void> {
    const metrics = await this.getMetrics();

    metrics.totalVerifications++;
    metrics.averageVerificationTime =
      (metrics.averageVerificationTime * (metrics.totalVerifications - 1) +
        duration) /
      metrics.totalVerifications;
    metrics.lastVerificationAt = new Date();

    if (success) {
      metrics.successfulVerifications++;
    } else {
      metrics.failedVerifications++;
      // We'll categorize failures in a more detailed implementation
      metrics.verificationFailures.other++;
    }

    await this.saveMetrics(metrics);
  }

  async recordVerificationFailure(
    type: 'signature' | 'timestamp' | 'nonce' | 'other',
  ): Promise<void> {
    const metrics = await this.getMetrics();
    metrics.failedVerifications++;
    metrics.verificationFailures[type]++;
    await this.saveMetrics(metrics);
  }

  async getMetrics(): Promise<WebhookMetrics> {
    try {
      const data = await this.redisCache.get<string>(WEBHOOK_METRICS_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        return {
          ...parsed,
          lastVerificationAt: new Date(parsed.lastVerificationAt),
        };
      }
    } catch (error) {
      this.logger.warn('Failed to parse webhook metrics, using defaults');
    }

    return this.getDefaultMetrics();
  }

  async resetMetrics(): Promise<void> {
    await this.saveMetrics(this.getDefaultMetrics());
  }

  private getDefaultMetrics(): WebhookMetrics {
    return {
      totalVerifications: 0,
      successfulVerifications: 0,
      failedVerifications: 0,
      averageVerificationTime: 0,
      lastVerificationAt: new Date(),
      verificationFailures: {
        signature: 0,
        timestamp: 0,
        nonce: 0,
        other: 0,
      },
    };
  }

  private async saveMetrics(metrics: WebhookMetrics): Promise<void> {
    await this.redisCache.set(
      WEBHOOK_METRICS_KEY,
      JSON.stringify(metrics),
      86400,
    ); // 24 hours TTL
  }

  async getHealthStatus(): Promise<{ healthy: boolean; issues: string[] }> {
    const metrics = await this.getMetrics();
    const issues: string[] = [];

    // Check failure rate
    if (metrics.totalVerifications > 100) {
      const failureRate =
        metrics.failedVerifications / metrics.totalVerifications;
      if (failureRate > 0.1) {
        // 10% failure rate threshold
        issues.push(`High failure rate: ${(failureRate * 100).toFixed(2)}%`);
      }
    }

    // Check average verification time
    if (metrics.averageVerificationTime > 1000) {
      // 1 second threshold
      issues.push(
        `Slow verification: ${metrics.averageVerificationTime.toFixed(2)}ms average`,
      );
    }

    // Check for specific failure patterns
    const totalFailures = Object.values(metrics.verificationFailures).reduce(
      (a, b) => a + b,
      0,
    );
    if (totalFailures > 50) {
      const signatureFailureRate =
        metrics.verificationFailures.signature / totalFailures;
      if (signatureFailureRate > 0.5) {
        issues.push('High signature verification failure rate');
      }
    }

    return {
      healthy: issues.length === 0,
      issues,
    };
  }
}
