/* eslint-disable prettier/prettier */
import { Controller, Get, Query, Param, BadRequestException } from '@nestjs/common';
import { RecommendationsService } from './recommendation.service';

@Controller('recommendations')
export class RecommendationsController {
  constructor(
    private readonly recommendationsService: RecommendationsService,
  ) {}

  // 1. Existing Nearby Logic
  @Get('nearby')
  async getNearbyListings(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('radius') radius: string,
  ) {
    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);
    const maxDistance = parseInt(radius) || 5000;

    if (isNaN(userLat) || isNaN(userLng)) {
      throw new BadRequestException('Invalid latitude or longitude');
    }

    return this.recommendationsService.findNearbyListings(userLat, userLng, maxDistance);
  }

  // 2. NEW: Similar Products (Required for Task #141)
  // Usage: GET /recommendations/products/123/similar
  @Get('products/:id/similar')
  async getSimilar(@Param('id') id: string) {
    return await this.recommendationsService.getSimilarProducts(id);
  }

  // 3. NEW: Personalized Recommendations (Required for Task #141)
  // Usage: GET /recommendations/users/456/recommended
  @Get('users/:userId/recommended')
  async getUserRecs(@Param('userId') userId: string) {
    return await this.recommendationsService.getRecommendedForUser(userId);
  }
}