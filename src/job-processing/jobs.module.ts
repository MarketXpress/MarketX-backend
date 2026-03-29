import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import {
  EMAIL_QUEUE,
  IMAGE_PROCESSING_QUEUE,
  LEGACY_EMAIL_QUEUE,
  RECOMMENDATIONS_QUEUE,
} from './queue.constants';

@Global()
@Module({
  imports: [
    BullModule.registerQueue(
      { name: LEGACY_EMAIL_QUEUE },
      { name: EMAIL_QUEUE },
      { name: IMAGE_PROCESSING_QUEUE },
      { name: RECOMMENDATIONS_QUEUE },
      { name: 'orders' },
      { name: 'notifications' },
    ),
  ],
  exports: [BullModule],
})
export class JobsModule {}
