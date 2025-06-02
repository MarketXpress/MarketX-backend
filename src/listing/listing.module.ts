import { Module } from '@nestjs/common';
import { Listing } from './entities/listing.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ListingsController } from './listing.controller';
import { ListingsService } from './listing.service';

@Module({
  imports: [TypeOrmModule.forFeature([Listing])],
  controllers: [ListingsController],
  providers: [ListingsService],
  exports: [ListingsService],
})
export class ListingsModule {}
