import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  Body,
  UseInterceptors,
  UploadedFiles,
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
  ApiParam,
} from '@nestjs/swagger';
import { MediaService, UploadedImageResult } from '../media/media.service';
import { ProductImage } from '../media/entities/image.entity';
import { UploadImageDto, ReorderImagesDto } from '../media/dto/upload-image.dto';

@ApiTags('Product Images')
@Controller('products')
export class ProductImagesController {
  constructor(private readonly mediaService: MediaService) {}

  /**
   * Upload images for a product
   * POST /products/:id/images
   */
  @Post(':id/images')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Upload images for a product',
    description: 'Upload multiple images for a product. Supports JPEG, PNG, and WebP formats (max 5MB each). Generates thumbnail (200x200), medium (800x800), and original variants.',
  })
  @ApiParam({
    name: 'id',
    description: 'Product ID (UUID)',
    type: 'string',
  })
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
          description: 'Image files to upload (max 10 files)',
        },
        altText: {
          type: 'string',
          description: 'Alternative text for accessibility',
          example: 'Product front view',
        },
        displayOrder: {
          type: 'integer',
          description: 'Display order for the images (optional, auto-incremented if not provided)',
          example: 0,
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Images uploaded successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '550e8400-e29b-41d4-a716-446655440000' },
          productId: { type: 'string', example: '550e8400-e29b-41d4-a716-446655440001' },
          originalName: { type: 'string', example: 'product-image.jpg' },
          variants: {
            type: 'object',
            properties: {
              thumbnail: {
                type: 'object',
                properties: {
                  url: { type: 'string' },
                  width: { type: 'number', example: 200 },
                  height: { type: 'number', example: 200 },
                  size: { type: 'number', example: 10240 },
                },
              },
              medium: {
                type: 'object',
                properties: {
                  url: { type: 'string' },
                  width: { type: 'number', example: 800 },
                  height: { type: 'number', example: 600 },
                  size: { type: 'number', example: 51200 },
                },
              },
              original: {
                type: 'object',
                properties: {
                  url: { type: 'string' },
                  width: { type: 'number', example: 1920 },
                  height: { type: 'number', example: 1440 },
                  size: { type: 'number', example: 204800 },
                },
              },
            },
          },
          displayOrder: { type: 'number', example: 0 },
          altText: { type: 'string', example: 'Product front view' },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid file format or size' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
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
              `Invalid file type: ${file.mimetype}. Allowed types: JPEG, PNG, WebP`,
            ),
            false,
          );
        }
      },
    }),
  )
  async uploadProductImages(
    @Param('id') productId: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body() dto?: UploadImageDto,
  ): Promise<UploadedImageResult[]> {
    return this.mediaService.uploadProductImages(productId, files, dto);
  }

  /**
   * Get all images for a product
   * GET /products/:id/images
   */
  @Get(':id/images')
  @ApiOperation({
    summary: 'Get all images for a product',
    description: 'Retrieve all images associated with a product, ordered by display order',
  })
  @ApiParam({
    name: 'id',
    description: 'Product ID (UUID)',
    type: 'string',
  })
  @ApiResponse({
    status: 200,
    description: 'List of product images',
    type: [ProductImage],
  })
  async getProductImages(
    @Param('id') productId: string,
  ): Promise<ProductImage[]> {
    return this.mediaService.getProductImages(productId);
  }

  /**
   * Reorder images for a product
   * POST /products/:id/images/reorder
   */
  @Post(':id/images/reorder')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Reorder images for a product',
    description: 'Reorder images by providing an array of image IDs in the desired order',
  })
  @ApiParam({
    name: 'id',
    description: 'Product ID (UUID)',
    type: 'string',
  })
  @ApiBody({ type: ReorderImagesDto })
  @ApiResponse({
    status: 200,
    description: 'Images reordered successfully',
    type: [ProductImage],
  })
  @ApiResponse({ status: 400, description: 'Invalid image IDs provided' })
  async reorderImages(
    @Param('id') productId: string,
    @Body() dto: ReorderImagesDto,
  ): Promise<ProductImage[]> {
    return this.mediaService.reorderImages(productId, dto.imageIds);
  }

  /**
   * Delete all images for a product
   * DELETE /products/:id/images
   */
  @Delete(':id/images')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete all images for a product',
    description: 'Delete all images associated with a product from both storage and database',
  })
  @ApiParam({
    name: 'id',
    description: 'Product ID (UUID)',
    type: 'string',
  })
  @ApiResponse({ status: 204, description: 'All images deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async deleteProductImages(
    @Param('id') productId: string,
  ): Promise<void> {
    await this.mediaService.deleteProductImages(productId);
  }
}
