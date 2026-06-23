import { Test, TestingModule } from '@nestjs/testing';
import { ReviewsController } from './review.controller';
import { ReviewsService } from './review.service';

describe('ReviewsController', () => {
  let controller: ReviewsController;

  const mockReviewsService = {
    create: jest.fn(),
    findByProduct: jest.fn(),
  } as jest.Mocked<Pick<ReviewsService, 'create' | 'findByProduct'>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReviewsController],
      providers: [
        {
          provide: ReviewsService,
          useValue: mockReviewsService,
        },
      ],
    }).compile();

    controller = module.get<ReviewsController>(ReviewsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});