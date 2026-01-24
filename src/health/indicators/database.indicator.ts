import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { DataSource } from 'typeorm';

@Injectable()
export class DatabaseIndicator {
  constructor(private dataSource: DataSource) {}

  async isHealthy(): Promise<HealthIndicatorResult> {
    try {
      // Test database connectivity with a simple query
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      
      // Execute with timeout to ensure fast response
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Database health check timeout')), 2000);
      });
      
      const queryPromise = queryRunner.query('SELECT 1');
      
      // Race the query against the timeout
      await Promise.race([
        queryPromise,
        timeoutPromise
      ]);
      
      await queryRunner.release();

      // Get database info for detailed reporting
      const dbName = this.dataSource.options.database;
      const dbHost = (this.dataSource.options as any).host || 'localhost';
      
      return {
        database: {
          status: 'up',
          database: dbName || 'unknown',
          host: dbHost || 'unknown',
        },
      };
    } catch (error) {
      throw new HealthCheckError('Database check failed', {
        database: {
          status: 'down',
          message: error.message,
        },
      });
    }
  }
}