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
  Inject,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiHeader,
} from '@nestjs/swagger';
import {
  CacheInterceptor,
  CacheTTL,
  CACHE_MANAGER,
} from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
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
  constructor(
    private readonly productsService: ProductsService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  @Get()
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(60)
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
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30)
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
  async create(@Req() req: any, @Body() dto: CreateProductDto) {
    const product = await this.productsService.create(
      req.user.id.toString(),
      dto,
    );
    await (this.cacheManager as any).reset();
    return product;
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update product' })
  async update(
    @Param('id') id: string,
    @Req() req: any,
    @Body() dto: UpdateProductDto,
  ) {
    const product = await this.productsService.update(
      id,
      req.user.id.toString(),
      dto,
    );
    await (this.cacheManager as any).reset();
    return product;
  }

  @Patch(':id/price')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update product price' })
  async updatePrice(
    @Param('id') id: string,
    @Req() req: any,
    @Body() dto: UpdatePriceDto,
  ) {
    const result = await this.productsService.updatePrice(
      id,
      req.user.id.toString(),
      dto,
    );
    await (this.cacheManager as any).reset();
    return result;
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
  async remove(@Param('id') id: string, @Req() req: any) {
    const result = await this.productsService.remove(
      id,
      req.user.id.toString(),
    );
    await (this.cacheManager as any).reset();
    return result;
  }
}
