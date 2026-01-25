import { Injectable } from '@nestjs/common';
import { HealthCheckService, HealthIndicatorResult } from '@nestjs/terminus';
import { DatabaseIndicator } from './indicators/database.indicator';
import { StellarIndicator } from './indicators/stellar.indicator';

@Injectable()
export class HealthService {
  constructor(
    private health: HealthCheckService,
    private dbIndicator: DatabaseIndicator,
    private stellarIndicator: StellarIndicator,
  ) {}

  async checkHealth(): Promise<{ status: string; info?: any; error?: any; details: any }> {
    return await this.health.check([
      async () => this.dbIndicator.isHealthy(),
      async () => this.stellarIndicator.isHealthy(),
    ]);
  }

  async checkLiveness(): Promise<{ status: string; info?: any; error?: any; details: any }> {
    // Basic liveness check - application is running
    return await this.health.check([
      async () => this.applicationLivenessCheck(),
    ]);
  }

  async checkReadiness(): Promise<{ status: string; info?: any; error?: any; details: any }> {
    // Readiness check - checks if the application is ready to accept traffic
    return await this.health.check([
      async () => this.dbIndicator.isHealthy(),
      async () => this.stellarIndicator.isHealthy(),
    ]);
  }

  private async applicationLivenessCheck(): Promise<HealthIndicatorResult> {
    // Basic liveness check - application is running
    return { application: { status: 'up' } };
  }
}