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
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { FilterProductDto } from './dto/filter-product.dto';
import { UpdatePriceDto } from './dto/update-price.dto';
import { SupportedCurrency } from './services/pricing.service';
import { VerifiedSellerGuard } from '../verification/guards/verified-seller.guard';

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
  findOne(
    @Param('id') id: string,
    @Query('preferredCurrency') preferredCurrency?: SupportedCurrency,
  ) {
    return this.productsService.findOne(id, preferredCurrency);
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(VerifiedSellerGuard)
  @ApiOperation({ summary: 'Create product (verified seller only)' })
  create(@Req() req, @Body() dto: CreateProductDto) {
    return this.productsService.create(req.user.id.toString(), dto);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(VerifiedSellerGuard)
  @ApiOperation({ summary: 'Update product (verified owner only)' })
  update(@Param('id') id: string, @Req() req, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, req.user.id.toString(), dto);
  }

  @Patch(':id/price')
  @ApiBearerAuth()
  @UseGuards(VerifiedSellerGuard)
  @ApiOperation({ summary: 'Update product price (verified owner only)' })
  updatePrice(@Param('id') id: string, @Req() req, @Body() dto: UpdatePriceDto) {
    return this.productsService.updatePrice(id, req.user.id.toString(), dto);
  }

  @Get(':id/price-history')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get price change history for a product' })
  getPriceHistory(@Param('id') id: string) {
    return this.productsService.getPriceHistory(id);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(VerifiedSellerGuard)
  @ApiOperation({ summary: 'Delete product (verified owner only)' })
  async remove(@Param('id') id: string, @Req() req) {
    return this.productsService.remove(id, req.user.id.toString());
  }
}
