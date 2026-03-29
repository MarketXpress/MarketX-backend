import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  AmqpConnectionManager,
  ChannelWrapper,
  connect,
} from 'amqp-connection-manager';

@Injectable()
export class RabbitMqService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMqService.name);
  private readonly exchange = 'marketx.domain-events';
  private connection?: AmqpConnectionManager;
  private channel?: ChannelWrapper;

  constructor(
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  onModuleInit(): void {
    const amqpUrl =
      this.configService.get<string>('AMQP_URL') ||
      this.configService.get<string>('RABBITMQ_URL') ||
      'amqp://rabbitmq:5672';

    this.connection = connect([amqpUrl]);
    this.channel = this.connection.createChannel({
      setup: async (channel) => {
        await channel.assertExchange(this.exchange, 'fanout', {
          durable: true,
        });
      },
    });

    this.eventEmitter.onAny((eventName, payload) => {
      void this.publish(String(eventName), payload);
    });

    this.logger.log(`RabbitMQ broadcasting enabled on ${amqpUrl}`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.channel?.close();
    await this.connection?.close();
  }

  async publish(eventName: string, payload: unknown): Promise<void> {
    if (!this.channel) {
      return;
    }

    const body = Buffer.from(
      JSON.stringify({
        eventName,
        payload,
        occurredAt: new Date().toISOString(),
      }),
    );

    await this.channel.publish(this.exchange, '', body, {
      contentType: 'application/json',
      persistent: true,
      type: eventName,
    });
  }
}
