import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  ParseIntPipe,
  DefaultValuePipe,
  HttpCode,
  HttpStatus,
  Request,
  UseGuards,
} from '@nestjs/common';
import { CreateReviewDto } from './dto/create-review.dto';
import { PaginatedReviewsResult, ReviewsService } from './review.service';
import { Review } from './entities/review.entity';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';

/**
 * ReviewsController
 *
 * Routes:
 *   POST /products/:id/reviews  — authenticated buyer submits a review
 *   GET  /products/:id/reviews  — public paginated list of reviews
 */
@ApiTags('Reviews')
@Controller('products/:id/reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  /**
   * POST /products/:id/reviews
   * Requires authentication. Only buyers with a COMPLETED order may proceed.
   */
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a product review' })
  @ApiResponse({ status: 201, description: 'Review created successfully.' })
  async create(
    @Param('id', ParseUUIDPipe) productId: string,
    @Body() dto: CreateReviewDto,
    @Request() req: { user: { id: string } },
  ): Promise<Review> {
    return this.reviewsService.create(productId, req.user.id, dto);
  }

  /**
   * GET /products/:id/reviews?page=1&limit=20
   * Public endpoint — no auth required.
   */
  @Get()
  @Public()
  @ApiOperation({ summary: 'List reviews for a product' })
  @ApiResponse({
    status: 200,
    description: 'Paginated product reviews returned.',
  })
  async findAll(
    @Param('id', ParseUUIDPipe) productId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ): Promise<PaginatedReviewsResult> {
    return this.reviewsService.findByProduct(productId, page, limit);
  }
}
