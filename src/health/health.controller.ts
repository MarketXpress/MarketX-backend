import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { DatabaseIndicator } from './indicators/database.indicator';
import { RedisIndicator } from './indicators/redis.indicator';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly dbIndicator: DatabaseIndicator,
    private readonly redisIndicator: RedisIndicator,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({
    summary: 'Check application readiness',
    description:
      'Checks all hard application dependencies required to serve traffic.',
  })
  @ApiResponse({
    status: 200,
    description: 'Application and required dependencies are healthy.',
  })
  @ApiResponse({
    status: 503,
    description: 'One or more required dependencies are unavailable.',
  })
  check() {
    return this.health.check([
      () => this.dbIndicator.isHealthy(),
      () => this.redisIndicator.isHealthy(),
    ]);
  }

  @Get('live')
  @ApiOperation({
    summary: 'Check application liveness',
    description:
      'Dependency-free probe that confirms the application process is running.',
  })
  @ApiResponse({
    status: 200,
    description: 'Application process is live.',
  })
  liveness() {
    return {
      status: 'up',
    };
  }
}
