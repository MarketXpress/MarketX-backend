import {
  Controller,
  Delete,
  Get,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { MediaService } from './media.service';
import { ProductImage } from './entities/image.entity';

@ApiTags('Images')
@Controller('images')
export class ImagesController {
  constructor(private readonly mediaService: MediaService) {}

  /**
   * Get a single image by ID
   * GET /images/:id
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get a single image by ID',
    description: 'Retrieve details of a specific image including all variants (thumbnail, medium, original)',
  })
  @ApiParam({
    name: 'id',
    description: 'Image ID (UUID)',
    type: 'string',
  })
  @ApiResponse({
    status: 200,
    description: 'Image details',
    type: ProductImage,
  })
  @ApiResponse({ status: 404, description: 'Image not found' })
  async getImageById(
    @Param('id') id: string,
  ): Promise<ProductImage> {
    return this.mediaService.getImageById(id);
  }

  /**
   * Delete a single image
   * DELETE /images/:id
   */
  @Delete(':id')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a single image',
    description: 'Delete an image from both storage (S3/Local) and database. This action cannot be undone.',
  })
  @ApiParam({
    name: 'id',
    description: 'Image ID (UUID)',
    type: 'string',
  })
  @ApiResponse({ status: 204, description: 'Image deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Image not found' })
  async deleteImage(@Param('id') id: string): Promise<void> {
    return this.mediaService.deleteImage(id);
  }
}
