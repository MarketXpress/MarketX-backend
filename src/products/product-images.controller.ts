import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Product Images')
@Controller('products')
export class ProductImagesController {
  @Get(':id/images')
  @ApiOperation({
    summary: 'Get product images (media module pending reimplementation)',
  })
  @ApiResponse({ status: 200, description: 'Product images returned.' })
  getImages(@Param('id') id: string) {
    return { productId: id, images: [] };
  }
}
