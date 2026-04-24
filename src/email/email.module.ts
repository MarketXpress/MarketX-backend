import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { WebhooksModule } from '../webhooks/webhooks.module';

import { EmailService } from './email.service';
import { EmailProcessor } from './email.processor';
import { EmailPreferenceService } from './email-preference.service';
import { EmailController } from './email.controller';
import { OrderEmailListener } from './listeners/order-email.listener';

import { EmailPreference } from './entities/email-preference.entity';
import { EmailLog } from './entities/email-log.entity';
import { EMAIL_QUEUE } from '../job-processing/queue.constants';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([EmailPreference, EmailLog]),
    BullModule.registerQueue({
      name: EMAIL_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    }),
    UsersModule, // provides UsersService for OrderEmailListener
    WebhooksModule,
  ],
  controllers: [EmailController],
  providers: [
    EmailService,
    EmailProcessor,
    EmailPreferenceService,
    OrderEmailListener,
  ],
  exports: [EmailService, EmailPreferenceService],
})
export class EmailModule {}
