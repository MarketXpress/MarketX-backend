import { Module, Provider } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductImage } from './entities/image.entity';
import { MediaService } from './media.service';
import { MediaController } from './media.controller';
import { ImagesController } from './images.controller';
import { ImageProcessingService } from './services/image-processing.service';
import { LocalStorageProvider } from './providers/local-storage.provider';
import { S3StorageProvider } from './providers/s3-storage.provider';
import { ModerationService } from './services/moderation.service';
import { MediaProcessor } from './media.processor';
import { IMAGE_PROCESSING_QUEUE } from '../job-processing/queue.constants';

/**
 * Requirement: Cloud Storage Integration (AWS S3)
 * Factory function to provide the appropriate storage provider based on environment config.
 */
const storageProviderFactory: Provider = {
  provide: 'STORAGE_PROVIDER', // Injected into MediaService
  useFactory: (configService: ConfigService) => {
    const provider = configService.get<string>('STORAGE_PROVIDER') || 'local';

    switch (provider.toLowerCase()) {
      case 's3':
      case 'aws':
        return new S3StorageProvider(configService);
      case 'local':
      default:
        // Defaulting to LocalStorage for dev environments
        return new LocalStorageProvider(configService);
    }
  },
  inject: [ConfigService],
};

@Module({
  imports: [
    TypeOrmModule.forFeature([ProductImage]), // Requirement: Store image metadata
    ConfigModule,
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
    storageProviderFactory,
  ],
  exports: [MediaService, ImageProcessingService],
})
export class MediaModule {}
