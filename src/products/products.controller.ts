import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { FilterProductDto } from './dto/filter-product.dto';

@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @ApiOperation({ summary: 'List products with filters & pagination' })
  findAll(@Query() filters: FilterProductDto) {
    return this.productsService.findAll(filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get product by ID' })
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create product (seller only)' })
  create(@Req() req, @Body() dto: CreateProductDto) {
    return this.productsService.create(req.user?.id ?? 'seller-1', dto);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update product (owner only)' })
  update(@Param('id') id: string, @Req() req, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, req.user?.id ?? 'seller-1', dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete product (owner only)' })
  remove(@Param('id') id: string, @Req() req) {
    return this.productsService.remove(id, req.user?.id ?? 'seller-1');
  }
}
