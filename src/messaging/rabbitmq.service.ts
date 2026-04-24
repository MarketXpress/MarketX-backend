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
import { ConfirmChannel, Options } from 'amqplib';
import {
  createEventEnvelope,
  validateEventContract,
  EventEnvelope,
} from '../common/event-contracts';

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
      this.logger.warn('RabbitMQ channel not available, skipping publish');
      return;
    }

    try {
      // Extract domain from event name (e.g., 'order.created' -> 'order')
      const domain = eventName.split('.')[0] || 'unknown';
      
      // Create event envelope with contract
      const envelope: EventEnvelope = createEventEnvelope(
        domain,
        eventName,
        payload,
      );

      // Validate the envelope before publishing
      if (!validateEventContract(envelope)) {
        this.logger.error(`Invalid event contract for ${eventName}`);
        return;
      }

      const body = Buffer.from(JSON.stringify(envelope));

      // Use properly typed publish options
      const publishOptions: Options.Publish = {
        contentType: 'application/json',
        contentEncoding: 'utf-8',
        persistent: true,
        type: eventName,
        timestamp: Math.floor(Date.now() / 1000),
        headers: {
          'x-event-type': eventName,
          'x-domain': domain,
          'x-schema-version': envelope.schemaVersion,
          'x-event-id': envelope.eventId,
        },
      };

      await this.channel.publish(this.exchange, '', body, publishOptions);
      
      this.logger.debug(`Published event: ${eventName} (${envelope.eventId})`);
    } catch (error) {
      this.logger.error(`Failed to publish event ${eventName}:`, error);
      throw error;
    }
  }
}
