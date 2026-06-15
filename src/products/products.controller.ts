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
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiHeader,
} from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { FilterProductDto } from './dto/filter-product.dto';
import { UpdatePriceDto } from './dto/update-price.dto';
import { SupportedCurrency } from './services/pricing.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @ApiOperation({ summary: 'List products with filters & pagination' })
  @ApiHeader({
    name: 'X-Currency',
    required: false,
    description: 'Target currency',
  })
  findAll(@Query() filters: FilterProductDto) {
    return this.productsService.findAll(filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get product by ID' })
  findOne(
    @Param('id') id: string,
    @Query('preferredCurrency') preferredCurrency?: SupportedCurrency,
  ) {
    return this.productsService.findOne(id, preferredCurrency);
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create product' })
  create(@Req() req: any, @Body() dto: CreateProductDto) {
    return this.productsService.create(req.user.id.toString(), dto);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update product' })
  update(
    @Param('id') id: string,
    @Req() req: any,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productsService.update(id, req.user.id.toString(), dto);
  }

  @Patch(':id/price')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update product price' })
  updatePrice(
    @Param('id') id: string,
    @Req() req: any,
    @Body() dto: UpdatePriceDto,
  ) {
    return this.productsService.updatePrice(id, req.user.id.toString(), dto);
  }

  @Get(':id/price-history')
  @ApiOperation({ summary: 'Get price change history for a product' })
  getPriceHistory(@Param('id') id: string) {
    return this.productsService.getPriceHistory(id);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Delete product' })
  remove(@Param('id') id: string, @Req() req: any) {
    return this.productsService.remove(id, req.user.id.toString());
  }
}
