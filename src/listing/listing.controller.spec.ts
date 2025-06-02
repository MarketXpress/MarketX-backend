import { Test, TestingModule } from '@nestjs/testing';
import { ListingController } from './listing.controller';
import { ListingService } from './listing.service';

describe('ListingController', () => {
  let controller: ListingController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ListingController],
      providers: [ListingService],
    }).compile();

    controller = module.get<ListingController>(ListingController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
