import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ProductImage,
  ImageFormat,
  ImageVariants,
} from './entities/image.entity';
import { UploadImageDto } from './dto/upload-image.dto';
import { ImageProcessingService } from './services/image-processing.service';
import { StorageProvider } from './interfaces/storage-provider.interface';
import * as crypto from 'crypto';

export interface UploadedImageResult {
  id: string;
  productId: string;
  originalName: string;
  variants: ImageVariants;
  displayOrder: number;
  altText?: string;
}

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private readonly storageProvider: string;

  constructor(
    @InjectRepository(ProductImage)
    private readonly imageRepository: Repository<ProductImage>,
    private readonly imageProcessingService: ImageProcessingService,
    private readonly configService: ConfigService,
    @Inject('STORAGE_PROVIDER')
    private readonly storage: StorageProvider,
  ) {
    this.storageProvider =
      this.configService.get<string>('STORAGE_PROVIDER') || 'local';
  }

  /**
   * Upload and process product images
   */
  async uploadProductImages(
    productId: string,
    files: Express.Multer.File[],
    dto?: UploadImageDto,
  ): Promise<UploadedImageResult[]> {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided');
    }

    const results: UploadedImageResult[] = [];

    // Get current max display order for the product
    const maxOrderResult = await this.imageRepository
      .createQueryBuilder('image')
      .select('MAX(image.displayOrder)', 'maxOrder')
      .where('image.productId = :productId', { productId })
      .getRawOne();

    let currentOrder = (maxOrderResult?.maxOrder ?? -1) + 1;

    for (const file of files) {
      try {
        const result = await this.uploadSingleImage(
          productId,
          file,
          dto,
          currentOrder++,
        );
        results.push(result);
      } catch (error) {
        this.logger.error(
          `Failed to upload image: ${file.originalname}`,
          error,
        );
        throw error;
      }
    }

    return results;
  }

  /**
   * Upload a single image with processing, validation, and duplicate prevention.
   */
  private async uploadSingleImage(
    productId: string,
    file: Express.Multer.File,
    dto?: UploadImageDto,
    displayOrder: number = 0,
  ): Promise<UploadedImageResult> {
    // 1. Requirement: Prevent duplicate uploads
    const contentHash = this.computeContentHash(file.buffer);

    // Check if this specific product already has an image with this content
    // We store the hash in the storageKey or a metadata field to ensure idempotency
    const existingImage = await this.imageRepository.findOne({
      where: {
        productId,
        storageKey: Like(`%${contentHash}%`),
      },
    });

    if (existingImage) {
      this.logger.debug(
        `Duplicate image detected for product ${productId}. Skipping processing.`,
      );
      return {
        id: existingImage.id,
        productId: existingImage.productId,
        originalName: existingImage.originalName,
        variants: existingImage.variants,
        displayOrder: existingImage.displayOrder,
        altText: existingImage.altText,
      };
    }

    // 2. Requirement: Image Validation and Transformation (3 sizes)
    // processImage internally validates size (5MB) and dimensions
    const processedVariants = await this.imageProcessingService.processImage(
      file.buffer,
      file.originalname,
    );

    // 3. Cloud Storage Integration
    const variants: Partial<ImageVariants> = {};
    const timestamp = Date.now();
    const sanitizedName = this.sanitizeFileName(file.originalname);
    // Include the hash in the baseKey to ensure unique but deterministic paths
    const baseKey = `products/${productId}/${timestamp}-${contentHash}-${sanitizedName}`;

    for (const [variantName, processed] of Object.entries(processedVariants)) {
      const variantKey = `${baseKey}/${variantName}.${processed.format}`;

      // Upload optimized version to S3/CDN
      const uploadResult = await this.storage.upload(
        processed.buffer,
        variantKey,
        `image/${processed.format}`,
        {
          productId,
          variant: variantName,
          originalName: file.originalname,
          contentHash, // Store hash in S3 metadata for extra safety
        },
      );

      variants[variantName as keyof ImageVariants] = {
        url: uploadResult.url,
        width: processed.width,
        height: processed.height,
        size: processed.size,
      };
    }

    // 4. Requirement: Store image metadata in database
    const image = this.imageRepository.create({
      productId,
      originalName: file.originalname,
      format: this.getFormatFromMimeType(file.mimetype),
      mimeType: file.mimetype,
      originalWidth: processedVariants.original.width,
      originalHeight: processedVariants.original.height,
      originalSize: file.size,
      variants: variants as ImageVariants,
      altText: dto?.altText,
      displayOrder: dto?.displayOrder ?? displayOrder,
      storageKey: baseKey,
      storageProvider: this.storageProvider,
    });

    const savedImage = await this.imageRepository.save(image);

    this.logger.debug(
      `Image uploaded successfully: ${savedImage.id} for product ${productId}`,
    );

    return {
      id: savedImage.id,
      productId: savedImage.productId,
      originalName: savedImage.originalName,
      variants: savedImage.variants,
      displayOrder: savedImage.displayOrder,
      altText: savedImage.altText,
    };
  }

  /**
   * Get all images for a product
   */
  async getProductImages(productId: string): Promise<ProductImage[]> {
    return this.imageRepository.find({
      where: { productId },
      order: { displayOrder: 'ASC', createdAt: 'ASC' },
    });
  }

  /**
   * Get a single image by ID
   */
  async getImageById(id: string): Promise<ProductImage> {
    const image = await this.imageRepository.findOne({
      where: { id },
    });

    if (!image) {
      throw new NotFoundException(`Image with ID ${id} not found`);
    }

    return image;
  }

  /**
   * Update image metadata
   */
  async updateImage(
    id: string,
    updates: Partial<Pick<ProductImage, 'altText' | 'displayOrder'>>,
  ): Promise<ProductImage> {
    const image = await this.getImageById(id);

    Object.assign(image, updates);

    return this.imageRepository.save(image);
  }

  /**
   * Reorder images for a product
   */
  async reorderImages(
    productId: string,
    imageIds: string[],
  ): Promise<ProductImage[]> {
    const images = await this.getProductImages(productId);
    const imageMap = new Map(images.map((img) => [img.id, img]));

    // Validate all images exist and belong to the product
    for (const id of imageIds) {
      if (!imageMap.has(id)) {
        throw new BadRequestException(
          `Image ${id} does not exist or does not belong to this product`,
        );
      }
    }

    // Update display order
    const updates: Promise<ProductImage>[] = [];
    for (let i = 0; i < imageIds.length; i++) {
      const image = imageMap.get(imageIds[i])!;
      image.displayOrder = i;
      updates.push(this.imageRepository.save(image));
    }

    await Promise.all(updates);

    return this.getProductImages(productId);
  }

  /**
   * Delete a single image
   */
  async deleteImage(id: string): Promise<void> {
    const image = await this.getImageById(id);

    // Delete from storage
    try {
      const keysToDelete = [
        `${image.storageKey}/thumbnail.${image.format}`,
        `${image.storageKey}/medium.${image.format}`,
        `${image.storageKey}/original.${image.format}`,
      ];

      await this.storage.deleteMany(keysToDelete);
      this.logger.debug(`Deleted image files from storage: ${id}`);
    } catch (error) {
      this.logger.error(`Failed to delete image from storage: ${id}`, error);
      // Continue to delete from database even if storage deletion fails
    }

    // Delete from database
    await this.imageRepository.remove(image);
    this.logger.debug(`Deleted image from database: ${id}`);
  }

  /**
   * Delete all images for a product
   */
  async deleteProductImages(productId: string): Promise<number> {
    const images = await this.getProductImages(productId);

    if (images.length === 0) {
      return 0;
    }

    // Delete from storage
    const keysToDelete: string[] = [];
    for (const image of images) {
      keysToDelete.push(
        `${image.storageKey}/thumbnail.${image.format}`,
        `${image.storageKey}/medium.${image.format}`,
        `${image.storageKey}/original.${image.format}`,
      );
    }

    try {
      await this.storage.deleteMany(keysToDelete);
      this.logger.debug(
        `Deleted ${images.length} image sets from storage for product ${productId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to delete images from storage for product ${productId}`,
        error,
      );
    }

    // Delete from database
    await this.imageRepository.remove(images);
    this.logger.debug(
      `Deleted ${images.length} images from database for product ${productId}`,
    );

    return images.length;
  }

  /**
   * Get primary image for a product
   */
  async getPrimaryImage(productId: string): Promise<ProductImage | null> {
    const image = await this.imageRepository.findOne({
      where: { productId },
      order: { displayOrder: 'ASC', createdAt: 'ASC' },
    });

    return image || null;
  }

  /**
   * Sanitize file name for storage
   */
  private sanitizeFileName(fileName: string): string {
    const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '');
    return nameWithoutExt
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 50);
  }

  /**
   * Get format from MIME type — returns the ImageFormat enum value
   */
  private getFormatFromMimeType(mimeType: string): ImageFormat {
    switch (mimeType) {
      case 'image/jpeg':
        return ImageFormat.JPEG;
      case 'image/png':
        return ImageFormat.PNG;
      case 'image/webp':
        return ImageFormat.WEBP;
      default:
        return ImageFormat.JPEG;
    }
  }

  /**
   * Compute SHA-256 hash of a file buffer for duplicate detection
   */
  private computeContentHash(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }
}
