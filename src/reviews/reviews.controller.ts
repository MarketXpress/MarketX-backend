import { Controller, Post, Get, Param, Body, UseGuards, Req } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller()
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @UseGuards(JwtAuthGuard)
  @Post('orders/:id/review')
  createReview(@Param('id') orderId: number, @Req() req, @Body() dto: CreateReviewDto) {
    return this.reviewsService.createReview(orderId, req.user.id, dto);
  }

  @Get('sellers/:id/reviews')
  getSellerReviews(@Param('id') sellerId: number) {
    return this.reviewsService.getSellerReviews(sellerId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('reviews/:id/report')
  reportReview(@Param('id') reviewId: number) {
    return this.reviewsService.reportReview(reviewId);
  }
}
