import { Injectable } from '@nestjs/common';
import {
  HealthCheckError,
  HealthIndicator,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import { RabbitMqService } from '../../messaging/rabbitmq.service';

@Injectable()
export class RabbitMqIndicator extends HealthIndicator {
  constructor(private readonly rabbitMqService: RabbitMqService) {
    super();
  }

  async isReady(key = 'rabbitmq'): Promise<HealthIndicatorResult> {
    const isConnected = this.rabbitMqService.isConnected();

    if (isConnected) {
      return this.getStatus(key, true, {
        status: 'up',
        connected: true,
      });
    }

    throw new HealthCheckError(
      'RabbitMQ connection is down',
      this.getStatus(key, false, {
        status: 'down',
        connected: false,
      }),
    );
  }

  async isAlive(key = 'rabbitmq_liveness'): Promise<HealthIndicatorResult> {
    const initialized = this.rabbitMqService.isInitialized();

    if (initialized) {
      return this.getStatus(key, true, {
        status: 'up',
        initialized: true,
      });
    }

    throw new HealthCheckError(
      'RabbitMQ service not initialized',
      this.getStatus(key, false, {
        status: 'down',
        initialized: false,
      }),
    );
  }
}
