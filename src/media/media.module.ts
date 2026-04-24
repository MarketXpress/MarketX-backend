import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { TypeOrmModule } from '@nestjs/typeorm';

import { MediaService } from './media.service';
import { MediaProcessor } from './media.processor';
import { ImageProcessingService } from './services/image-processing.service';
import { MediaController } from './media.controller';
import { ImagesController } from './images.controller';
import { ModerationService } from './services/moderation.service';
import { ProductImage } from './entities/image.entity';
import { IMAGE_PROCESSING_QUEUE } from '../job-processing/queue.constants';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProductImage]), // Requirement: Store image metadata
    BullModule.registerQueue({
      name: IMAGE_PROCESSING_QUEUE,
    }),
  ],
  controllers: [
    MediaController, // Standard media endpoints
    ImagesController, // Specialized product image endpoints
  ],
  providers: [
    MediaService, // Requirement: Upload handling
    MediaProcessor,
    ImageProcessingService, // Requirement: Validation and Transformation
    ModerationService,
  ],
  exports: [MediaService, ImageProcessingService],
})
export class MediaModule {}
