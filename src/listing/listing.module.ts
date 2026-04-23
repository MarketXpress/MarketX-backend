import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ListingsController } from './listings.controller';
import { ListingsService } from './listings.service';
import { Listing } from './entities/listing.entity';
import { ListingVariant } from './entities/listing-variant.entity';
import { SearchModule } from '../search/search.module';

@Module({
  imports: [TypeOrmModule.forFeature([Listing, ListingVariant]), SearchModule],
  controllers: [ListingsController],
  providers: [ListingsService],
  exports: [ListingsService],
})
export class ListingsModule {}
