import { Test, TestingModule } from '@nestjs/testing';
import { ReviewsController } from './review.controller';
import { ReviewsService } from './review.service';

describe('ReviewController', () => {
  let controller: ReviewsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReviewsController],
      providers: [ReviewsService],
    }).compile();

    controller = module.get<ReviewsController>(ReviewsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
