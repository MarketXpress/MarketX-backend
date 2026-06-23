import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import {
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { CreateReviewDto } from './dto/create-review.dto';
import { Review } from './entities/review.entity';
import { ReviewsService } from './review.service';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PRODUCT_ID = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const USER_ID = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
const REVIEW_ID = 'cccccccc-cccc-4ccc-cccc-cccccccccccc';

function makeDto(overrides: Partial<CreateReviewDto> = {}): CreateReviewDto {
  return { rating: 4, body: 'Great product', ...overrides };
}

function makeSavedReview(overrides: Partial<Review> = {}): Review {
  return {
    id: REVIEW_ID,
    userId: USER_ID,
    productId: PRODUCT_ID,
    rating: 4,
    body: 'Great product',
    createdAt: new Date(),
    ...overrides,
  } as Review;
}

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockReviewRepository = {
  findAndCount: jest.fn(),
};

/**
 * Build a mock EntityManager that simulates the happy path by default.
 * Individual tests override specific methods via jest.fn().mockXxx().
 */
function buildMockEntityManager(
  overrides: Partial<EntityManager> = {},
): Partial<EntityManager> {
  return {
    query: jest.fn().mockImplementation((sql: string) => {
      if (sql.startsWith('SELECT id'))
        return Promise.resolve([
          { id: PRODUCT_ID, averageRating: 4, reviewCount: 1 },
        ]);
      if (sql.startsWith('SELECT o.id'))
        return Promise.resolve([{ id: 'order-id' }]);
      return Promise.resolve([]);
    }),
    findOne: jest.fn().mockResolvedValue(null), // no existing review
    create: jest.fn().mockReturnValue(makeSavedReview()),
    save: jest.fn().mockResolvedValue(makeSavedReview()),
    ...overrides,
  };
}

const mockDataSource = {
  transaction: jest.fn(),
};

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('ReviewsService', () => {
  let service: ReviewsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewsService,
        {
          provide: getRepositoryToken(Review),
          useValue: mockReviewRepository,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<ReviewsService>(ReviewsService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── create() ──────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('should create and return a review on the happy path', async () => {
      const em = buildMockEntityManager();
      mockDataSource.transaction.mockImplementation(
        (cb: (em: EntityManager) => Promise<Review>) => cb(em as EntityManager),
      );

      const result = await service.create(PRODUCT_ID, USER_ID, makeDto());

      expect(em.create).toHaveBeenCalledWith(Review, {
        userId: USER_ID,
        productId: PRODUCT_ID,
        rating: 4,
        body: 'Great product',
      });
      expect(em.save).toHaveBeenCalled();
      // Denormalization query should have been called
      expect(em.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE products'),
        [4, PRODUCT_ID],
      );
      expect(result.id).toBe(REVIEW_ID);
    });

    it('should set body to null when not provided', async () => {
      const em = buildMockEntityManager();
      mockDataSource.transaction.mockImplementation(
        (cb: (em: EntityManager) => Promise<Review>) => cb(em as EntityManager),
      );

      await service.create(PRODUCT_ID, USER_ID, { rating: 5 });

      expect(em.create).toHaveBeenCalledWith(
        Review,
        expect.objectContaining({ body: null }),
      );
    });

    it('should throw NotFoundException when product does not exist', async () => {
      const em = buildMockEntityManager({
        query: jest.fn().mockResolvedValue([]), // no product row
      });
      mockDataSource.transaction.mockImplementation(
        (cb: (em: EntityManager) => Promise<Review>) => cb(em as EntityManager),
      );

      await expect(
        service.create(PRODUCT_ID, USER_ID, makeDto()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when buyer has no COMPLETED order', async () => {
      const em = buildMockEntityManager({
        query: jest.fn().mockImplementation((sql: string) => {
          if (sql.startsWith('SELECT id'))
            return Promise.resolve([{ id: PRODUCT_ID }]);
          return Promise.resolve([]); // no completed order
        }),
      });
      mockDataSource.transaction.mockImplementation(
        (cb: (em: EntityManager) => Promise<Review>) => cb(em as EntityManager),
      );

      await expect(
        service.create(PRODUCT_ID, USER_ID, makeDto()),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ConflictException when buyer has already reviewed the product', async () => {
      const em = buildMockEntityManager({
        findOne: jest.fn().mockResolvedValue(makeSavedReview()), // existing review found
      });
      mockDataSource.transaction.mockImplementation(
        (cb: (em: EntityManager) => Promise<Review>) => cb(em as EntityManager),
      );

      await expect(
        service.create(PRODUCT_ID, USER_ID, makeDto()),
      ).rejects.toThrow(ConflictException);
    });

    it('should propagate unexpected DB errors', async () => {
      mockDataSource.transaction.mockRejectedValue(
        new Error('DB connection lost'),
      );

      await expect(
        service.create(PRODUCT_ID, USER_ID, makeDto()),
      ).rejects.toThrow('DB connection lost');
    });
  });

  // ─── findByProduct() ───────────────────────────────────────────────────────

  describe('findByProduct()', () => {
    it('should return paginated reviews for a product', async () => {
      const reviews = [makeSavedReview(), makeSavedReview({ id: 'other-id' })];
      mockReviewRepository.findAndCount.mockResolvedValue([reviews, 2]);

      const result = await service.findByProduct(PRODUCT_ID, 1, 20);

      expect(mockReviewRepository.findAndCount).toHaveBeenCalledWith({
        where: { productId: PRODUCT_ID },
        order: { createdAt: 'DESC' },
        skip: 0,
        take: 20,
      });
      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
      expect(result.meta.totalPages).toBe(1);
      expect(result.meta.hasNextPage).toBe(false);
      expect(result.meta.hasPreviousPage).toBe(false);
    });

    it('should return correct pagination meta for page 2', async () => {
      mockReviewRepository.findAndCount.mockResolvedValue([[], 45]);

      const result = await service.findByProduct(PRODUCT_ID, 2, 20);

      expect(result.meta.page).toBe(2);
      expect(result.meta.totalPages).toBe(3);
      expect(result.meta.hasNextPage).toBe(true);
      expect(result.meta.hasPreviousPage).toBe(true);
    });

    it('should clamp limit to 100', async () => {
      mockReviewRepository.findAndCount.mockResolvedValue([[], 0]);

      await service.findByProduct(PRODUCT_ID, 1, 9999);

      expect(mockReviewRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });

    it('should clamp page to minimum of 1', async () => {
      mockReviewRepository.findAndCount.mockResolvedValue([[], 0]);

      await service.findByProduct(PRODUCT_ID, -5, 20);

      expect(mockReviewRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0 }),
      );
    });

    it('should return empty data array when no reviews exist', async () => {
      mockReviewRepository.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.findByProduct(PRODUCT_ID);

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
      expect(result.meta.totalPages).toBe(0);
    });
  });
});
