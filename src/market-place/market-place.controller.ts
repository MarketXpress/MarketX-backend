import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { MarketPlaceService } from './market-place.service';
import { CreateMarketPlaceDto } from './dto/create-market-place.dto';
import { ListingsService } from 'src/listing/listing.service';

@Controller('market-place')
export class MarketPlaceController {
  constructor(
    private readonly marketPlaceService: MarketPlaceService,
    private readonly listingsService: ListingsService,
  ) {}

  @Post()
  create(@Body() createMarketPlaceDto: CreateMarketPlaceDto) {
    return this.marketPlaceService.create(createMarketPlaceDto);
  }
  @Get('feed')
  async getPublicFeed(
    @Query('take') takeStr?: string,
    @Query('skip') skipStr?: string,
  ) {
    // parse query params with defaults
    const take = Math.min(parseInt(takeStr ?? '', 10) || 10, 50);
    const skip = parseInt(skipStr ?? '', 10) || 0;

    const { listings, total } =
      await this.listingsService.findActiveListingsPaginated({take, skip});

    return {
      data: listings,
      meta: {
        total,
        take,
        skip,
      },
    };
  }
}
