import { HealthCheckError } from '@nestjs/terminus';
import { Queue } from 'bull';
import { QueuesIndicator } from './queues.indicator';

const makeQueue = (pingResult: string, status = 'ready'): Queue => {
  return {
    client: Promise.resolve({
      ping: jest.fn().mockResolvedValue(pingResult),
      status,
    }),
  } as unknown as Queue;
};

describe('QueuesIndicator', () => {
  const createIndicator = (pingResult: string) =>
    new QueuesIndicator(
      makeQueue(pingResult),
      makeQueue(pingResult),
      makeQueue(pingResult),
      makeQueue(pingResult),
      makeQueue(pingResult),
      makeQueue(pingResult),
    );

  it('reports ready when all queue clients respond to ping', async () => {
    const indicator = createIndicator('PONG');

    await expect(indicator.isReady()).resolves.toMatchObject({
      queues: {
        status: 'up',
      },
    });
  });

  it('throws when any queue ping is unhealthy', async () => {
    const indicator = createIndicator('FAIL');

    await expect(indicator.isReady()).rejects.toBeInstanceOf(HealthCheckError);
  });

  it('reports liveness when all queues are initialized', async () => {
    const indicator = createIndicator('PONG');

    await expect(indicator.isAlive()).resolves.toMatchObject({
      queues_liveness: {
        status: 'up',
        initialized: 6,
      },
    });
  });
});
