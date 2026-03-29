import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Listing } from '../listing/entities/listing.entity';
import { ListingsModule } from '../listing/listing.module';
import {
  BrowsingHistory,
  PurchaseHistory,
  FrequentlyBoughtTogether,
  UserSimilarity,
} from './entities';
import { RecommendationsService } from './recommendation.service';
import { RecommendationsController } from './recommendation.controller';
import { RecommendationProcessor } from './recommendation.processor';
import { RecommendationScheduler } from './recommendation.scheduler';
import { RECOMMENDATIONS_QUEUE } from '../job-processing/queue.constants';

@Module({
  imports: [
    BullModule.registerQueue({
      name: RECOMMENDATIONS_QUEUE,
    }),
    TypeOrmModule.forFeature([
      Listing,
      BrowsingHistory,
      PurchaseHistory,
      FrequentlyBoughtTogether,
      UserSimilarity,
    ]),
    ListingsModule,
  ],
  providers: [
    RecommendationsService,
    RecommendationProcessor,
    RecommendationScheduler,
  ],
  controllers: [RecommendationsController],
  exports: [RecommendationsService],
})
export class RecommendationsModule {}
