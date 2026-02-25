import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';

import { EmailService } from './email.service';
import { EmailProcessor } from './email.processor';
import { EmailPreferenceService } from './email-preference.service';
import { EmailController } from './email.controller';
import { OrderEmailListener } from './listeners/order-email.listener';

import { EmailPreference } from './entities/email-preference.entity';
import { EmailLog } from './entities/email-log.entity';

@Global()
@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([EmailPreference, EmailLog]),
    BullModule.registerQueue({
      name: 'email',
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
export class EmailModule { }
