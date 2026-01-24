import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Review } from './entities/review.entity';
import { CreateReviewDto } from './dto/create-review.dto';
import { Order } from '../orders/entities/order.entity';
import { Users } from '../users/users.entity';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review) private reviewRepo: Repository<Review>,
    @InjectRepository(Order) private orderRepo: Repository<Order>,
    @InjectRepository(Users) private userRepo: Repository<Users>,
  ) {}

  async createReview(orderId: number, buyerId: number, dto: CreateReviewDto) {
    const order = await this.orderRepo.findOne({ where: { id: orderId }, relations: ['buyer', 'seller'] });
    if (!order) throw new NotFoundException('Order not found');

    if (order.buyer.id !== buyerId) throw new ForbiddenException('Only the buyer can review this order');
    if (order.review) throw new BadRequestException('Review already exists for this order');

    const review = this.reviewRepo.create({
      rating: dto.rating,
      comment: dto.comment,
      buyer: order.buyer,
      seller: order.seller,
      order,
    });

    await this.reviewRepo.save(review);

    // Update seller aggregate rating
    await this.updateSellerRating(order.seller.id);

    return review;
  }

  async getSellerReviews(sellerId: number) {
    const reviews = await this.reviewRepo.find({
      where: { seller: { id: sellerId } },
      order: { createdAt: 'DESC' },
    });
    return reviews;
  }

  async reportReview(reviewId: number) {
    const review = await this.reviewRepo.findOne({ where: { id: reviewId } });
    if (!review) throw new NotFoundException('Review not found');
    review.reported = true;
    return this.reviewRepo.save(review);
  }

  private async updateSellerRating(sellerId: number) {
    const reviews = await this.reviewRepo.find({ where: { seller: { id: sellerId } } });
    if (!reviews.length) return;

    const avgRating = reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length;

    await this.userRepo.update(sellerId, { averageRating: avgRating });
  }
}
