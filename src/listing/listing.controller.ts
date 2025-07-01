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
} from '@nestjs/common';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { ListingsService } from './listing.service';
import { RateLimit, UserRateLimit } from '../decorators/rate-limit.decorator';
import { RateLimitGuard } from '../guards/rate-limit.guard';
import { UserTier } from '../rate-limiting/rate-limit.service';

@Controller('listings')
@UseGuards(RateLimitGuard)
@UserRateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 30,
  tierLimits: {
    [UserTier.FREE]: { maxRequests: 10 },
    [UserTier.PREMIUM]: { maxRequests: 50 },
    [UserTier.ENTERPRISE]: { maxRequests: 200 },
  },
})
export class ListingsController {
  constructor(private readonly listingsService: ListingsService) {}

  @Post()
  @RateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxRequests: 5,
    tierLimits: {
      [UserTier.PREMIUM]: { maxRequests: 15 },
      [UserTier.ENTERPRISE]: { maxRequests: 50 },
    },
    message: 'Too many listings created. Please wait before creating more.',
  })
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
}
