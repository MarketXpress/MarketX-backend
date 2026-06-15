import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Product Images')
@Controller('products')
export class ProductImagesController {
  @Get(':id/images')
  @ApiOperation({ summary: 'Get product images (media module pending reimplementation)' })
  getImages(@Param('id') id: string) {
    return { productId: id, images: [] };
  }
}
