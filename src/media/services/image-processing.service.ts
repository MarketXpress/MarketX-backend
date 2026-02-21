import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as sharp from 'sharp';
import { ImageFormat } from '../entities/image.entity';
import {
  ImageProcessingOptions,
  ProcessedImage,
} from '../interfaces/storage-provider.interface';

export interface ImageDimensions {
  width: number;
  height: number;
}

export interface ImageValidationResult {
  valid: boolean;
  error?: string;
  dimensions?: ImageDimensions;
  format?: ImageFormat;
  size?: number;
}

export interface ImageVariantConfig {
  name: string;
  width: number;
  height?: number;
  quality: number;
  fit: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
}

@Injectable()
export class ImageProcessingService {
  private readonly logger = new Logger(ImageProcessingService.name);
  private readonly maxFileSize: number;
  private readonly allowedFormats: string[];
  private readonly maxWidth: number;
  private readonly maxHeight: number;

  // Image variant configurations
  private readonly variantConfigs: Record<string, ImageVariantConfig> = {
    thumbnail: {
      name: 'thumbnail',
      width: 200,
      height: 200,
      quality: 80,
      fit: 'cover',
    },
    medium: {
      name: 'medium',
      width: 800,
      height: 800,
      quality: 85,
      fit: 'inside',
    },
    original: {
      name: 'original',
      width: 2048,
      height: 2048,
      quality: 90,
      fit: 'inside',
    },
  };

  constructor(private readonly configService: ConfigService) {
    // Max file size: 5MB (default)
    this.maxFileSize =
      parseInt(
        this.configService.get<string>('MAX_IMAGE_SIZE_MB') || '5',
        10,
      ) *
      1024 *
      1024;

    // Allowed formats: JPEG, PNG, WebP
    this.allowedFormats = ['image/jpeg', 'image/png', 'image/webp'];

    // Max dimensions
    this.maxWidth = parseInt(
      this.configService.get<string>('MAX_IMAGE_WIDTH') || '4096',
      10,
    );
    this.maxHeight = parseInt(
      this.configService.get<string>('MAX_IMAGE_HEIGHT') || '4096',
      10,
    );
  }

  /**
   * Validate image file before processing
   */
  async validateImage(buffer: Buffer): Promise<ImageValidationResult> {
    // Check file size
    if (buffer.length > this.maxFileSize) {
      return {
        valid: false,
        error: `File size exceeds maximum allowed size of ${this.maxFileSize / 1024 / 1024}MB`,
      };
    }

    try {
      // Get image metadata
      const metadata = await sharp(buffer).metadata();

      if (!metadata.format || !metadata.width || !metadata.height) {
        return {
          valid: false,
          error: 'Unable to read image metadata',
        };
      }

      // Check format
      const mimeType = this.getMimeType(metadata.format);
      if (!this.allowedFormats.includes(mimeType)) {
        return {
          valid: false,
          error: `Invalid image format. Allowed formats: JPEG, PNG, WebP`,
        };
      }

      // Check dimensions
      if (metadata.width > this.maxWidth || metadata.height > this.maxHeight) {
        return {
          valid: false,
          error: `Image dimensions exceed maximum allowed size of ${this.maxWidth}x${this.maxHeight}`,
        };
      }

      const format = this.mapSharpFormatToEnum(metadata.format);

      return {
        valid: true,
        dimensions: {
          width: metadata.width,
          height: metadata.height,
        },
        format,
        size: buffer.length,
      };
    } catch (error) {
      this.logger.error('Image validation failed', error);
      return {
        valid: false,
        error: 'Invalid image file',
      };
    }
  }

  /**
   * Process image and generate multiple variants
   */
  async processImage(
    buffer: Buffer,
    originalName: string,
  ): Promise<Record<string, ProcessedImage>> {
    const validation = await this.validateImage(buffer);

    if (!validation.valid) {
      throw new BadRequestException(validation.error);
    }

    const results: Record<string, ProcessedImage> = {};

    // Generate each variant
    for (const [variantName, config] of Object.entries(this.variantConfigs)) {
      try {
        const processed = await this.resizeImage(buffer, {
          width: config.width,
          height: config.height,
          quality: config.quality,
          format: validation.format?.toLowerCase() as 'jpeg' | 'png' | 'webp',
          fit: config.fit,
        });

        results[variantName] = processed;
        this.logger.debug(
          `Generated ${variantName} variant: ${processed.width}x${processed.height}, ${processed.size} bytes`,
        );
      } catch (error) {
        this.logger.error(`Failed to generate ${variantName} variant`, error);
        throw new BadRequestException(
          `Failed to process image variant: ${variantName}`,
        );
      }
    }

    return results;
  }

  /**
   * Resize image with specified options
   */
  async resizeImage(
    buffer: Buffer,
    options: ImageProcessingOptions,
  ): Promise<ProcessedImage> {
    const sharpInstance = sharp(buffer);

    // Resize
    if (options.width || options.height) {
      sharpInstance.resize({
        width: options.width,
        height: options.height,
        fit: options.fit || 'inside',
        withoutEnlargement: true,
      });
    }

    // Set format and quality
    const format = options.format || 'jpeg';
    const quality = options.quality || 85;

    switch (format) {
      case 'jpeg':
        sharpInstance.jpeg({ quality, progressive: true });
        break;
      case 'png':
        sharpInstance.png({ quality, progressive: true });
        break;
      case 'webp':
        sharpInstance.webp({ quality });
        break;
    }

    const processedBuffer = await sharpInstance.toBuffer();
    const metadata = await sharp(processedBuffer).metadata();

    return {
      buffer: processedBuffer,
      width: metadata.width || 0,
      height: metadata.height || 0,
      size: processedBuffer.length,
      format,
    };
  }

  /**
   * Convert image to WebP format for optimization
   */
  async convertToWebP(
    buffer: Buffer,
    quality: number = 85,
  ): Promise<ProcessedImage> {
    const webpBuffer = await sharp(buffer)
      .webp({ quality, effort: 4 })
      .toBuffer();

    const metadata = await sharp(webpBuffer).metadata();

    return {
      buffer: webpBuffer,
      width: metadata.width || 0,
      height: metadata.height || 0,
      size: webpBuffer.length,
      format: 'webp',
    };
  }

  /**
   * Get image dimensions
   */
  async getDimensions(buffer: Buffer): Promise<ImageDimensions> {
    const metadata = await sharp(buffer).metadata();
    return {
      width: metadata.width || 0,
      height: metadata.height || 0,
    };
  }

  /**
   * Map sharp format to ImageFormat enum
   */
  private mapSharpFormatToEnum(format: string): ImageFormat {
    switch (format.toLowerCase()) {
      case 'jpeg':
      case 'jpg':
        return ImageFormat.JPEG;
      case 'png':
        return ImageFormat.PNG;
      case 'webp':
        return ImageFormat.WEBP;
      default:
        return ImageFormat.JPEG;
    }
  }

  /**
   * Get MIME type from format
   */
  private getMimeType(format: string): string {
    switch (format.toLowerCase()) {
      case 'jpeg':
      case 'jpg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'webp':
        return 'image/webp';
      default:
        return `image/${format}`;
    }
  }

  /**
   * Get variant configurations
   */
  getVariantConfigs(): Record<string, ImageVariantConfig> {
    return this.variantConfigs;
  }
}
