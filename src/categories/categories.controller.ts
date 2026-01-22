import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
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
  @ApiOperation({ summary: 'Get category tree' })
  async getCategoriesTree() {
    return this.categoriesService.getTree();
  }

  /**
   * POST /categories
   * Creates a category (root or child).
   */
  @Post()
  @ApiOperation({ summary: 'Create a new category' })
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
  async getProductsByCategory(@Param('id', ParseIntPipe) id: number) {
    return {
      categoryId: id,
      includeDescendants: true,
      products: [],
      note: 'Placeholder endpoint. Product/category filtering will be implemented when Products module is added.',
    };
  }
}
