import {
  Controller,
  Get,
  Inject,
  CACHE_MANAGER,
  HttpStatus,
} from '@nestjs/common';
import {
  HealthCheckService,
  HealthCheck,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import { SkipRateLimit } from '@/common/decorators/rate-limit.decorator';
import { DatabaseIndicator } from './indicators/database.indicator';
import { StellarIndicator } from './indicators/stellar.indicator';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private dbIndicator: DatabaseIndicator,
    private stellarIndicator: StellarIndicator,
    @Inject(CACHE_MANAGER) private cacheManager: any,
  ) {}

  @Get()
  @SkipRateLimit()
  @HealthCheck()
  async check(): Promise<{ status: string; info?: any; error?: any; details: any }> {
    const startTime = Date.now();
    const result = await this.health.check([
      async () => this.dbIndicator.isHealthy(),
      async () => this.stellarIndicator.isHealthy(),
      async () => this.cacheHealthCheck(),
      async () => this.memoryHealthCheck(),
    ]);
    
    // Calculate response time
    const responseTime = Date.now() - startTime;
    
    // Ensure response is within 2 seconds as per requirements
    if (responseTime > 2000) {
      console.warn(`Health check took ${responseTime}ms, exceeding 2 second threshold`);
    }
    
    return result;
  }

  @Get('live')
  @SkipRateLimit()
  @HealthCheck()
  async liveness(): Promise<{ status: string; info?: any; error?: any; details: any }> {
    // Liveness probe - checks if the application is running
    return await this.health.check([
      async () => this.applicationLivenessCheck(),
    ]);
  }

  @Get('ready')
  @SkipRateLimit()
  @HealthCheck()
  async readiness(): Promise<{ status: string; info?: any; error?: any; details: any }> {
    // Readiness probe - checks if the application is ready to accept traffic
    return await this.health.check([
      async () => this.dbIndicator.isHealthy(),
      async () => this.stellarIndicator.isHealthy(),
      async () => this.cacheHealthCheck(),
    ]);
  }

  private async cacheHealthCheck(): Promise<HealthIndicatorResult> {
    try {
      // Attempt to set and get a test key in cache
      const testKey = 'health_check_test';
      const testValue = Date.now().toString();
      
      await this.cacheManager.set(testKey, testValue, 1000); // 1 second TTL
      const retrievedValue = await this.cacheManager.get(testKey);
      
      if (retrievedValue === testValue) {
        return { cache: { status: 'up' } };
      } else {
        return { cache: { status: 'down', message: 'Cache not responding correctly' } };
      }
    } catch (error) {
      return { cache: { status: 'down', message: error.message } };
    }
  }

  private async memoryHealthCheck(): Promise<HealthIndicatorResult> {
    const used = process.memoryUsage();
    const heapUsedPercent = (used.heapUsed / used.heapTotal) * 100;
    
    // Consider memory healthy if less than 90% of heap is used
    if (heapUsedPercent < 90) {
      return { 
        memory: { 
          status: 'up', 
          heapUsedPercent: heapUsedPercent.toFixed(2) + '%',
          rss: `${Math.round(used.rss / 1024 / 1024)}MB`,
          heapTotal: `${Math.round(used.heapTotal / 1024 / 1024)}MB`,
          heapUsed: `${Math.round(used.heapUsed / 1024 / 1024)}MB`
        } 
      };
    } else {
      return { 
        memory: { 
          status: 'warn', 
          message: `High memory usage: ${heapUsedPercent.toFixed(2)}%`,
          heapUsedPercent: heapUsedPercent.toFixed(2) + '%'
        } 
      };
    }
  }

  private async applicationLivenessCheck(): Promise<HealthIndicatorResult> {
    // Basic liveness check - application is running
    return { application: { status: 'up' } };
  }
}