import { Module, Provider } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductImage } from './entities/image.entity';
import { MediaService } from './media.service';
import { MediaController } from './media.controller';
import { ImagesController } from './images.controller';
import { ImageProcessingService } from './services/image-processing.service';
import { LocalStorageProvider } from './providers/local-storage.provider';
import { S3StorageProvider } from './providers/s3-storage.provider';

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
  ],
  controllers: [
    MediaController, // Standard media endpoints
    ImagesController, // Specialized product image endpoints
  ],
  providers: [
    MediaService, // Requirement: Upload handling
    ImageProcessingService, // Requirement: Validation and Transformation
    storageProviderFactory,
  ],
  exports: [MediaService, ImageProcessingService],
})
export class MediaModule {}
