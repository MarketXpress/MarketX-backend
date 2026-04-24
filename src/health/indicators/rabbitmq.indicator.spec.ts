import { HealthCheckError } from '@nestjs/terminus';
import { RabbitMqIndicator } from './rabbitmq.indicator';

describe('RabbitMqIndicator', () => {
  it('reports ready when broker is connected', async () => {
    const indicator = new RabbitMqIndicator({
      isConnected: () => true,
      isInitialized: () => true,
    } as any);

    await expect(indicator.isReady()).resolves.toMatchObject({
      rabbitmq: {
        status: 'up',
        connected: true,
      },
    });
  });

  it('throws when broker is disconnected', async () => {
    const indicator = new RabbitMqIndicator({
      isConnected: () => false,
      isInitialized: () => true,
    } as any);

    await expect(indicator.isReady()).rejects.toBeInstanceOf(HealthCheckError);
  });

  it('reports liveness when service is initialized', async () => {
    const indicator = new RabbitMqIndicator({
      isConnected: () => false,
      isInitialized: () => true,
    } as any);

    await expect(indicator.isAlive()).resolves.toMatchObject({
      rabbitmq_liveness: {
        status: 'up',
        initialized: true,
      },
    });
  });
});
