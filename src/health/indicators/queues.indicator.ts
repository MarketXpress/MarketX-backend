import { InjectQueue } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import {
  HealthCheckError,
  HealthIndicator,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import { Queue } from 'bull';
import {
  EMAIL_QUEUE,
  IMAGE_PROCESSING_QUEUE,
  LEGACY_EMAIL_QUEUE,
  RECOMMENDATIONS_QUEUE,
} from '../../job-processing/queue.constants';

@Injectable()
export class QueuesIndicator extends HealthIndicator {
  private readonly queues: Array<{ name: string; queue: Queue }>;

  constructor(
    @InjectQueue(LEGACY_EMAIL_QUEUE)
    private readonly legacyEmailQueue: Queue,
    @InjectQueue(EMAIL_QUEUE)
    private readonly emailQueue: Queue,
    @InjectQueue(IMAGE_PROCESSING_QUEUE)
    private readonly imageQueue: Queue,
    @InjectQueue(RECOMMENDATIONS_QUEUE)
    private readonly recommendationsQueue: Queue,
    @InjectQueue('orders')
    private readonly ordersQueue: Queue,
    @InjectQueue('notifications')
    private readonly notificationsQueue: Queue,
  ) {
    super();

    this.queues = [
      { name: LEGACY_EMAIL_QUEUE, queue: this.legacyEmailQueue },
      { name: EMAIL_QUEUE, queue: this.emailQueue },
      { name: IMAGE_PROCESSING_QUEUE, queue: this.imageQueue },
      { name: RECOMMENDATIONS_QUEUE, queue: this.recommendationsQueue },
      { name: 'orders', queue: this.ordersQueue },
      { name: 'notifications', queue: this.notificationsQueue },
    ];
  }

  async isReady(key = 'queues'): Promise<HealthIndicatorResult> {
    const details: Record<string, any> = {};

    for (const { name, queue } of this.queues) {
      try {
        const client = await (queue as any).client;
        const ping = await client.ping();

        details[name] = {
          status: ping === 'PONG' ? 'up' : 'down',
          ping,
          redisStatus: client.status,
        };

        if (ping !== 'PONG') {
          throw new Error(`Unexpected ping result: ${String(ping)}`);
        }
      } catch (error) {
        throw new HealthCheckError(
          `Queue connectivity check failed for ${name}`,
          this.getStatus(key, false, {
            status: 'down',
            failedQueue: name,
            message: error instanceof Error ? error.message : String(error),
            queues: details,
          }),
        );
      }
    }

    return this.getStatus(key, true, {
      status: 'up',
      queues: details,
    });
  }

  async isAlive(key = 'queues_liveness'): Promise<HealthIndicatorResult> {
    const initializedQueues = this.queues.filter(({ queue }) => Boolean(queue));

    if (initializedQueues.length === this.queues.length) {
      return this.getStatus(key, true, {
        status: 'up',
        initialized: initializedQueues.length,
      });
    }

    throw new HealthCheckError(
      'One or more queues are not initialized',
      this.getStatus(key, false, {
        status: 'down',
        initialized: initializedQueues.length,
        expected: this.queues.length,
      }),
    );
  }
}
