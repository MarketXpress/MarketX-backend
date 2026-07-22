import { Controller, Get } from '@nestjs/common';
import { HealthCheckService, HealthCheck } from '@nestjs/terminus';
import { DatabaseIndicator } from './indicators/database.indicator';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private dbIndicator: DatabaseIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([() => this.dbIndicator.isHealthy()]);
  }

  @Get('live')
  liveness() {
    return { status: 'up' };
  }
}
