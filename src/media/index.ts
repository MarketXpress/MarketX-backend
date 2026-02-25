// Export all public APIs from the media module
export {
  ProductImage,
  ImageFormat,
  ImageVariant,
  ImageVariants,
} from './entities/image.entity';
export {
  UploadImageDto,
  ImageMetadataDto,
  ReorderImagesDto,
} from './dto/upload-image.dto';
export { MediaService, UploadedImageResult } from './media.service';
export { MediaModule } from './media.module';
export {
  StorageProvider,
  UploadResult,
  ImageProcessingOptions,
  ProcessedImage,
} from './interfaces/storage-provider.interface';
