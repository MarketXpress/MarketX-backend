import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { HealthCheckService, HealthCheck } from '@nestjs/terminus';
import { DatabaseIndicator } from './indicators/database.indicator';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private dbIndicator: DatabaseIndicator,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Check application health' })
  @ApiResponse({ status: 200, description: 'Health status returned.' })
  check() {
    return this.health.check([() => this.dbIndicator.isHealthy()]);
  }

  @Get('live')
  @ApiOperation({ summary: 'Check application liveness' })
  @ApiResponse({ status: 200, description: 'Application is live.' })
  liveness() {
    return { status: 'up' };
  }
}
