
import { Module } from '@nestjs/common';
import { ListingController } from './listing.controller';

@Module({
  controllers: [ListingController],
  providers: [],
  exports: []
})
export class ListingModule {}

// src/app.module.ts
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ListingModule } from './listing/listing.module';

@Module({
  imports: [ListingModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}