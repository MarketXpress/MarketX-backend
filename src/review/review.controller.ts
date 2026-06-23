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
} from '@nestjs/common';
import { CreateReviewDto } from './dto/create-review.dto';
import { PaginatedReviewsResult, ReviewsService } from './review.service';
import { Review } from './entities/review.entity';

// ── Adjust to your auth guard path ──────────────────────────────────────────
// import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
// ────────────────────────────────────────────────────────────────────────────

/**
 * ReviewsController
 *
 * Routes:
 *   POST /products/:id/reviews  — authenticated buyer submits a review
 *   GET  /products/:id/reviews  — public paginated list of reviews
 */
@Controller('products/:id/reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  /**
   * POST /products/:id/reviews
   * Requires authentication. Only buyers with a COMPLETED order may proceed.
   */
  // @UseGuards(JwtAuthGuard)   ← uncomment once JwtAuthGuard path is confirmed
  @Post()
  @HttpCode(HttpStatus.CREATED)
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
  async findAll(
    @Param('id', ParseUUIDPipe) productId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ): Promise<PaginatedReviewsResult> {
    return this.reviewsService.findByProduct(productId, page, limit);
  }
}
