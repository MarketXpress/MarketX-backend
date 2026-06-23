import { Module } from '@nestjs/common';
import { ReviewsController } from './review.controller';
import { ReviewsService } from './review.service';

@Module({
  controllers: [ReviewsController],
  providers: [ReviewsService],
})
export class ReviewModule {}
