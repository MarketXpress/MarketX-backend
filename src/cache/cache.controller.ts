import { Controller, Get, Delete, Param, UseGuards } from '@nestjs/common';
import { CacheService } from './cache.service';
import { CacheManagerService } from './cache-manager.service';
import { CacheMonitoringService } from './cache-monitoring.service';
import { AdminGuard } from '../guards/admin.guard';

@Controller('cache')
@UseGuards(AdminGuard)
export class CacheController {
  constructor(
    private readonly cacheService: CacheService,
    private readonly cacheManager: CacheManagerService,
    private readonly monitoring: CacheMonitoringService
  ) {}

  @Get('metrics')
  getMetrics() {
    return this.cacheService.getMetrics();
  }

  @Get('health')
  async getHealth() {
    return this.monitoring.getCacheHealth();
  }

  @Delete('flush')
  async flushCache() {
    await this.cacheService.flush();
    return { message: 'Cache flushed successfully' };
  }

  @Delete('user/:userId')
  async invalidateUser(@Param('userId') userId: string) {
    await this.cacheManager.invalidateUser(userId);
    return { message: `User ${userId} cache invalidated` };
  }

  @Delete('listing/:listingId')
  async invalidateListing(@Param('listingId') listingId: string) {
    await this.cacheManager.invalidateListing(listingId);
    return { message: `Listing ${listingId} cache invalidated` };
  }

  @Delete('marketplace/:marketplaceId')
  async invalidateMarketplace(@Param('marketplaceId') marketplaceId: string) {
    await this.cacheManager.invalidateMarketplace(marketplaceId);
    return { message: `Marketplace ${marketplaceId} cache invalidated` };
  }
}
