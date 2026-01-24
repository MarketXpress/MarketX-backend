/* eslint-disable prettier/prettier */
import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { RecommendationsService } from './recommendation.service';

@Controller('recommendations')
export class RecommendationsController {
  constructor(
    private readonly recommendationsService: RecommendationsService,
  ) {}

  @Get('nearby')
  async getNearbyListings(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('radius') radius: string,
  ) {
    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);
    const maxDistance = parseInt(radius) || 5000; // default 5km

    if (
      isNaN(userLat) ||
      isNaN(userLng) ||
      userLat < -90 ||
      userLat > 90 ||
      userLng < -180 ||
      userLng > 180
    ) {
      throw new BadRequestException('Invalid latitude or longitude');
    }

    return this.recommendationsService.findNearbyListings(
      userLat,
      userLng,
      maxDistance,
    );
  }
}
