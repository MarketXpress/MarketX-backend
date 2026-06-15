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
    return this.health.check([() => this.dbIndicator.isHealthy()]);
  }

  async checkLiveness() {
    return this.health.check([() => this.applicationLivenessCheck()]);
  }

  async checkReadiness() {
    return this.health.check([() => this.dbIndicator.isHealthy()]);
  }

  private applicationLivenessCheck(): HealthIndicatorResult {
    return { application: { status: 'up' } };
  }
}
