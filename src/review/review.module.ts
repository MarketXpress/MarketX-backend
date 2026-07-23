import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReviewsController } from './review.controller';
import { ReviewsService } from './review.service';
import { Review } from './entities/review.entity';

@Module({
  controllers: [ReviewsController],
  imports: [TypeOrmModule.forFeature([Review])],
  providers: [ReviewsService],
})
export class ReviewModule {}
