import { Injectable } from '@nestjs/common';
import { HealthCheckService, HealthIndicatorResult } from '@nestjs/terminus';
import { DatabaseIndicator } from './indicators/database.indicator';

@Injectable()
export class HealthService {
  constructor(
    private health: HealthCheckService,
    private dbIndicator: DatabaseIndicator,
  ) {}

  async checkHealth() {
    return await this.health.check([async () => this.dbIndicator.isHealthy()]);
  }

  async checkLiveness() {
    return await this.health.check([async () => this.applicationLivenessCheck()]);
  }

  async checkReadiness() {
    return await this.health.check([async () => this.dbIndicator.isHealthy()]);
  }

  private async applicationLivenessCheck(): Promise<HealthIndicatorResult> {
    return { application: { status: 'up' } };
  }
}
