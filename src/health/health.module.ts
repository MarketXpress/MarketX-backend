import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { DatabaseIndicator } from './indicators/database.indicator';
import { StellarIndicator } from './indicators/stellar.indicator';
import { HealthController } from './health.controller';
import { RabbitMqModule } from '../messaging/rabbitmq.module';
import { JobsModule } from '../job-processing/jobs.module';
import { RabbitMqIndicator } from './indicators/rabbitmq.indicator';
import { QueuesIndicator } from './indicators/queues.indicator';

@Module({
  imports: [
    TerminusModule,
    TypeOrmModule,
    CacheModule.register(),
    RabbitMqModule,
    JobsModule,
  ],
  controllers: [HealthController],
  providers: [
    DatabaseIndicator,
    StellarIndicator,
    RabbitMqIndicator,
    QueuesIndicator,
  ],
  exports: [
    DatabaseIndicator,
    StellarIndicator,
    RabbitMqIndicator,
    QueuesIndicator,
  ],
})
export class HealthModule {}
