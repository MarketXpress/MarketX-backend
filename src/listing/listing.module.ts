import { Module } from '@nestjs/common';
import { Listing } from './entities/listing.entity';
import { ListingVariant } from './entities/listing-variant.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ListingsController } from './listing.controller';
import { ListingsService } from './listing.service';
import { ConfigModule } from '@nestjs/config';
import { SearchModule } from '../search/search.module';

@Module({
  imports: [TypeOrmModule.forFeature([Listing, ListingVariant]), ConfigModule, SearchModule],
  controllers: [ListingsController],
  providers: [ListingsService],
  exports: [ListingsService],
})
export class ListingsModule {}
