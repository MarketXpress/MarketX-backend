import { Injectable } from '@nestjs/common';
import { HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { DataSource } from 'typeorm';

@Injectable()
export class DatabaseIndicator {
  constructor(private readonly dataSource: DataSource) {}

  async isHealthy(): Promise<HealthIndicatorResult> {
    const queryRunner = this.dataSource.createQueryRunner();

    try {
      await queryRunner.connect();

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error('Database health check timeout')),
          2_000,
        );
      });

      const queryPromise = queryRunner.query('SELECT 1');

      await Promise.race([queryPromise, timeoutPromise]);

      return {
        database: {
          status: 'up',
        },
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown database error';

      throw new HealthCheckError('Database check failed', {
        database: {
          status: 'down',
          message,
        },
      });
    } finally {
      await queryRunner.release().catch(() => undefined);
    }
  }
}
