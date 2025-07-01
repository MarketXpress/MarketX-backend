/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Listing } from 'src/listing/entities/listing.entity';
import { RecommendationsService } from './recommendation.service';
import { RecommendationsController } from './recommendation.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Listing])],
  providers: [RecommendationsService],
  controllers: [RecommendationsController],
  exports: [RecommendationsService],
})
export class RecommendationsModule {}
