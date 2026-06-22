/**
 * ReviewsService
 *
 * Business rules:
 *  1. Only buyers with a COMPLETED order for the target product may submit a review.
 *  2. Each buyer may leave exactly one review per product (DB unique constraint +
 *     pre-flight check for a friendlier error).
 *  3. After insert, Product.averageRating and Product.reviewCount are updated in the
 *     same DB transaction — keeps product reads fast with no JOIN overhead.
 */

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { CreateReviewDto } from './dto/create-review.dto';
import { Review } from './entities/review.entity';

// ── Adjust these import paths to match your project layout ──────────────────
// import { Product } from '../entities/product.entity';
// import { Order }   from '../orders/order.entity';
// ────────────────────────────────────────────────────────────────────────────

export interface PaginatedReviewsResult {
  data: Review[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,

    /**
     * DataSource is used to run the insert + product-stat update atomically.
     * Product and Order repositories are resolved from the shared DataSource
     * so this module stays decoupled without circular imports.
     */
    private readonly dataSource: DataSource,
  ) {}

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Create a review. Guards checked in order:
   *   1. Product must exist.
   *   2. Caller must have a COMPLETED order that contains the product.
   *   3. Caller must not have already reviewed this product.
   *
   * Product.averageRating and Product.reviewCount are updated atomically.
   */
  async create(
    productId: string,
    userId: string,
    dto: CreateReviewDto,
  ): Promise<Review> {
    return this.dataSource.transaction(async (em: EntityManager) => {
      // 1. Product must exist
      // Using raw query runner so we don't need to import the Product class here.
      const [product] = await em.query(
        `SELECT id, "averageRating", "reviewCount" FROM products WHERE id = $1 LIMIT 1`,
        [productId],
      );
      if (!product) {
        throw new NotFoundException(`Product ${productId} not found`);
      }

      // 2. Buyer must have a COMPLETED order containing this product
      const [orderRow] = await em.query(
        `SELECT o.id
         FROM orders o
         JOIN order_items oi ON oi."orderId" = o.id
         WHERE o."userId" = $1
           AND oi."productId" = $2
           AND o.status = 'COMPLETED'
         LIMIT 1`,
        [userId, productId],
      );
      if (!orderRow) {
        throw new ForbiddenException(
          'You can only review products from your completed orders',
        );
      }

      // 3. Duplicate review check
      const existing = await em.findOne(Review, { where: { userId, productId } });
      if (existing) {
        throw new ConflictException('You have already reviewed this product');
      }

      // 4. Insert review
      const review = em.create(Review, {
        userId,
        productId,
        rating: dto.rating,
        body: dto.body ?? null,
      });
      const saved = await em.save(Review, review);

      // 5. Denormalize running average + count onto products row
      //    Formula: newAvg = (oldAvg * oldCount + newRating) / (oldCount + 1)
      //    Uses Postgres arithmetic to stay precise without a full recalculation.
      await em.query(
        `UPDATE products
         SET
           "reviewCount"   = "reviewCount" + 1,
           "averageRating" = ("averageRating" * "reviewCount" + $1) / ("reviewCount" + 1)
         WHERE id = $2`,
        [dto.rating, productId],
      );

      this.logger.log(
        `Review created: id=${saved.id} userId=${userId} productId=${productId} rating=${dto.rating}`,
      );

      return saved;
    });
  }

  /**
   * Paginated reviews for a product, newest first.
   */
  async findByProduct(
    productId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<PaginatedReviewsResult> {
    const validatedPage = Math.max(1, page);
    const validatedLimit = Math.min(100, Math.max(1, limit));

    const [data, total] = await this.reviewRepository.findAndCount({
      where: { productId },
      order: { createdAt: 'DESC' },
      skip: (validatedPage - 1) * validatedLimit,
      take: validatedLimit,
    });

    const totalPages = Math.ceil(total / validatedLimit);

    return {
      data,
      meta: {
        page: validatedPage,
        limit: validatedLimit,
        total,
        totalPages,
        hasNextPage: validatedPage < totalPages,
        hasPreviousPage: validatedPage > 1,
      },
    };
  }
}