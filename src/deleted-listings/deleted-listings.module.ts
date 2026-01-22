import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeletedListingsController } from './deleted-listings.controller';
import { DeletedListingsService } from './deleted-listings.service';
import { Listing } from '../listing/entities/listing.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Listing])],
  controllers: [DeletedListingsController],
  providers: [DeletedListingsService],
  exports: [DeletedListingsService],
})
export class DeletedListingsModule {} 