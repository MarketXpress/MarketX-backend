import { Module } from '@nestjs/common';
import { Listing } from './entities/listing.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ListingsController } from './listing.controller';
import { ListingsService } from './listing.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [TypeOrmModule.forFeature([Listing]), ConfigModule],
  controllers: [ListingsController],
  providers: [ListingsService],
  exports: [ListingsService],
})
export class ListingsModule {}
