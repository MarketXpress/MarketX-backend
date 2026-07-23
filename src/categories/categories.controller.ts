import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseInterceptors,
} from '@nestjs/common';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create.dto';

@ApiTags('Categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  /**
   * GET /categories
   * Returns a nested category tree.
   */
  @Get()
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(300)
  @ApiOperation({ summary: 'Get category tree' })
  @ApiResponse({ status: 200, description: 'Nested category tree returned.' })
  async getCategoriesTree() {
    return this.categoriesService.getTree();
  }

  /**
   * POST /categories
   * Creates a category (root or child).
   */
  @Post()
  @ApiOperation({ summary: 'Create a new category' })
  @ApiResponse({ status: 201, description: 'Category created successfully.' })
  async createCategory(@Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(dto);
  }

  /**
   * GET /categories/:id/products
   * Out of scope for this ticket: return dummy payload for now.
   * We keep the endpoint so the contract exists for later work.
   */
  @Get(':id/products')
  @ApiOperation({ summary: 'Get products by category (dummy placeholder)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Category products returned.' })
  getProductsByCategory(@Param('id', ParseIntPipe) id: number) {
    this.categoriesService.getProductsByCategory(id);
    return {
      categoryId: id,
      includeDescendants: true,
      products: [],
      note: 'Placeholder endpoint. Product/category filtering will be implemented when Products module is added.',
    };
  }
}
