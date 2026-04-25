import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';

import { SearchService } from './search.service';
import { SearchQueryDto } from './dto/search-query.dto';
import { RateLimitGuard } from '../guards/rate-limit.guard';
import { UserRateLimit } from '../decorators/rate-limit.decorator';
import { UserTier } from '../rate-limiting/rate-limit.service';

@ApiTags('Search')
@Controller('search')
@UseGuards(RateLimitGuard)
@UserRateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  maxRequests: 30,
  burstAllowance: 5,
  tierLimits: {
    [UserTier.FREE]: { maxRequests: 30 },
    [UserTier.PREMIUM]: { maxRequests: 100 },
    [UserTier.ENTERPRISE]: { maxRequests: 300 },
    [UserTier.ADMIN]: { maxRequests: 1000 },
  },
})
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({
    summary: 'Search and filter items',
    description:
      'Supports full-text search, category filtering, price range filtering, sorting, and pagination.',
  })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'seller', required: false })
  @ApiQuery({ name: 'minPrice', required: false })
  @ApiQuery({ name: 'maxPrice', required: false })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: ['price', 'date', 'popularity'],
  })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['ASC', 'DESC'] })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  search(@Query() query: SearchQueryDto) {
    return this.searchService.search(query.q || '', query);
  }
}
