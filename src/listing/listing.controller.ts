import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { ListingsService } from './listing.service';
import { CacheInterceptor } from '../cache/cache.interceptor';
import { Cacheable } from '../decorators/cacheable.decorator';
import { CacheControl } from '../decorators/cache-control.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ListingService } from './listing.service.spec';


@Controller('listings')
export class ListingsController {
  constructor(private readonly listingsService: ListingsService) {}
  private readonly listingService: ListingService

  @Post()
  create(@Body() dto: CreateListingDto, @Req() req) {
    return this.listingsService.create(dto, req.user.id);
  }

  @Get('activeListings')
  findActiveListingsPaginated(
    @Query('take') take?: string,
    @Query('skip') skip?: string,
    @Query('category') category?: string,
    @Query('location') location?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('q') q?: string,
  ) {
    return this.listingsService.findActiveListingsPaginated({
      take: parseInt(take || '10', 10),
      skip: parseInt(skip || '0', 10),
      category,
      location,
      minPrice: minPrice ? parseFloat(minPrice) : undefined,
      maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
      q,
    });
  }

  
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.listingsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateListingDto) {
    return this.listingsService.update(id, dto);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.listingsService.delete(id);
  }


    @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() createListingDto: CreateListingDto) {
    return this.listingService.create(createListingDto);
  }

  @Get()
  @UseInterceptors(CacheInterceptor)
  @Cacheable({ ttl: 1800, tags: ['listings'] })
  @CacheControl('public, max-age=1800')
  findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('category') category?: string,
    @Query('search') search?: string
  ) {
    return this.listingService.findAll(page, limit, category, search);
  }

  @Get('featured')
  @UseInterceptors(CacheInterceptor)
  @Cacheable({ ttl: 3600, tags: ['listings', 'featured'] })
  @CacheControl('public, max-age=3600')
  findFeatured() {
    return this.listingService.findFeatured();
  }

  @Get('popular')
  @UseInterceptors(CacheInterceptor)
  @Cacheable({ ttl: 7200, tags: ['listings', 'popular'] })
  @CacheControl('public, max-age=7200')
  findPopular() {
    return this.listingService.findPopular();
  }

  @Get(':id')
  @UseInterceptors(CacheInterceptor)
  @Cacheable({ ttl: 3600, tags: ['listings'] })
  @CacheControl('public, max-age=3600')
  findOne(@Param('id') id: string) {
    return this.listingService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(@Param('id') id: string, @Body() updateListingDto: UpdateListingDto) {
    return this.listingService.update(id, updateListingDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string) {
    return this.listingService.remove(id);
  }
}

}
