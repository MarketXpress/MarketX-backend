/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
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

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Listing,
      BrowsingHistory,
      PurchaseHistory,
      FrequentlyBoughtTogether,
      UserSimilarity,
    ]),
    ListingsModule,
  ],
  providers: [RecommendationsService],
  controllers: [RecommendationsController],
  exports: [RecommendationsService],
})
export class RecommendationsModule {}
