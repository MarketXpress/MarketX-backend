import { Module } from '@nestjs/common';
import { MarketPlaceService } from './market-place.service';
import { MarketPlaceController } from './market-place.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MarketPlace } from './entities/market-place.entity';
import { ListingsModule } from 'src/listing/listing.module';

@Module({
  imports: [ListingsModule,TypeOrmModule.forFeature([MarketPlace])],
  controllers: [MarketPlaceController],
  providers: [MarketPlaceService],
  exports: [MarketPlaceService],
})
export class MarketPlaceModule {}
