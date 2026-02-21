import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  Body,
  UseInterceptors,
  UploadedFiles,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiResponse,
} from '@nestjs/swagger';
import { MediaService, UploadedImageResult } from './media.service';
import { UploadImageDto, ReorderImagesDto } from './dto/upload-image.dto';
import { ProductImage } from './entities/image.entity';

@ApiTags('Media')
@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  /**
   * Upload images for a product
   */
  @Post('products/:productId/images')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload images for a product' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Product images (JPEG, PNG, WebP - max 5MB each)',
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
        },
        altText: {
          type: 'string',
          description: 'Alternative text for accessibility',
        },
        displayOrder: {
          type: 'integer',
          description: 'Display order for the images',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Images uploaded successfully',
    type: [ProductImage],
  })
  @ApiResponse({ status: 400, description: 'Invalid file format or size' })
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB max per file
      },
      fileFilter: (req, file, callback) => {
        const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
        if (allowedMimes.includes(file.mimetype)) {
          callback(null, true);
        } else {
          callback(
            new BadRequestException(
              `Invalid file type. Allowed types: JPEG, PNG, WebP`,
            ),
            false,
          );
        }
      },
    }),
  )
  async uploadProductImages(
    @Param('productId', ParseUUIDPipe) productId: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body() dto?: UploadImageDto,
  ): Promise<UploadedImageResult[]> {
    return this.mediaService.uploadProductImages(productId, files, dto);
  }

  /**
   * Get all images for a product
   */
  @Get('products/:productId/images')
  @ApiOperation({ summary: 'Get all images for a product' })
  @ApiResponse({
    status: 200,
    description: 'List of product images',
    type: [ProductImage],
  })
  async getProductImages(
    @Param('productId', ParseUUIDPipe) productId: string,
  ): Promise<ProductImage[]> {
    return this.mediaService.getProductImages(productId);
  }

  /**
   * Get a single image by ID
   */
  @Get('images/:id')
  @ApiOperation({ summary: 'Get a single image by ID' })
  @ApiResponse({
    status: 200,
    description: 'Image details',
    type: ProductImage,
  })
  @ApiResponse({ status: 404, description: 'Image not found' })
  async getImageById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ProductImage> {
    return this.mediaService.getImageById(id);
  }

  /**
   * Reorder images for a product
   */
  @Post('products/:productId/images/reorder')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reorder images for a product' })
  @ApiBody({ type: ReorderImagesDto })
  @ApiResponse({
    status: 200,
    description: 'Images reordered successfully',
    type: [ProductImage],
  })
  async reorderImages(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: ReorderImagesDto,
  ): Promise<ProductImage[]> {
    return this.mediaService.reorderImages(productId, dto.imageIds);
  }

  /**
   * Delete a single image
   */
  @Delete('images/:id')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a single image' })
  @ApiResponse({ status: 204, description: 'Image deleted successfully' })
  @ApiResponse({ status: 404, description: 'Image not found' })
  async deleteImage(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.mediaService.deleteImage(id);
  }

  /**
   * Delete all images for a product
   */
  @Delete('products/:productId/images')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete all images for a product' })
  @ApiResponse({ status: 204, description: 'All images deleted successfully' })
  async deleteProductImages(
    @Param('productId', ParseUUIDPipe) productId: string,
  ): Promise<void> {
    await this.mediaService.deleteProductImages(productId);
  }
}
