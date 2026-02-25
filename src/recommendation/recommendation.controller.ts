/* eslint-disable prettier/prettier */
import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  Body,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { RecommendationsService } from './recommendation.service';
import {
  TrackViewDto,
  AddToCartDto,
  GetRecommendationsDto,
  GetSimilarProductsDto,
  GetFrequentlyBoughtTogetherDto,
} from './dto/recommendation.dto';

@Controller('recommendations')
export class RecommendationsController {
  constructor(
    private readonly recommendationsService: RecommendationsService,
  ) {}

  // ==================== EXISTING ENDPOINTS ====================

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
    return this.recommendationsService.getSimilarProductsLegacy(id);
  }

  // 3. NEW: Personalized Recommendations (Required for Task #141)
  // Usage: GET /recommendations/users/456/recommended
  @Get('users/:userId/recommended')
  async getUserRecs(@Param('userId') userId: string) {
    return this.recommendationsService.getRecommendedForUserLegacy(userId);
  }

  // ==================== NEW ENDPOINTS ====================

  /**
   * Track a user's view of a product
   * POST /recommendations/views
   */
  @Post('views')
  @HttpCode(HttpStatus.CREATED)
  async trackView(@Body() trackViewDto: TrackViewDto) {
    return this.recommendationsService.trackView(trackViewDto);
  }

  /**
   * Track when a user adds a product to cart
   * POST /recommendations/cart
   */
  @Post('cart')
  @HttpCode(HttpStatus.CREATED)
  async trackAddToCart(@Body() addToCartDto: AddToCartDto) {
    return this.recommendationsService.trackAddToCart(addToCartDto);
  }

  /**
   * Get personalized recommendations for a user
   * GET /recommendations/personalized
   * Query params: userId, limit
   */
  @Get('personalized')
  async getPersonalizedRecommendations(
    @Query('userId') userId: string,
    @Query('limit') limit?: string,
  ) {
    const dto: GetRecommendationsDto = {
      userId,
      limit: limit ? parseInt(limit) : 10,
    };
    return this.recommendationsService.getRecommendedForUser(dto);
  }

  /**
   * Get similar products (new version with caching)
   * GET /recommendations/similar/:listingId
   */
  @Get('similar/:listingId')
  async getSimilarProductsNew(
    @Param('listingId') listingId: string,
    @Query('limit') limit?: string,
  ) {
    const dto: GetSimilarProductsDto = {
      listingId,
      limit: limit ? parseInt(limit) : 5,
    };
    return this.recommendationsService.getSimilarProducts(dto);
  }

  /**
   * Get frequently bought together items
   * GET /recommendations/frequently-bought-together/:listingId
   */
  @Get('frequently-bought-together/:listingId')
  async getFrequentlyBoughtTogether(
    @Param('listingId') listingId: string,
    @Query('limit') limit?: string,
  ) {
    const dto: GetFrequentlyBoughtTogetherDto = {
      listingId,
      limit: limit ? parseInt(limit) : 5,
    };
    return this.recommendationsService.getFrequentlyBoughtTogether(dto);
  }

  /**
   * Record a purchase (called after successful order)
   * POST /recommendations/purchase
   */
  @Post('purchase')
  @HttpCode(HttpStatus.CREATED)
  async recordPurchase(
    @Body()
    body: {
      userId: string;
      orderId: string;
      items: Array<{
        listingId: string;
        quantity: number;
        price: number;
        currency: string;
      }>;
    },
  ) {
    return this.recommendationsService.recordPurchase(
      body.userId,
      body.orderId,
      body.items,
    );
  }

  /**
   * Calculate user similarity (typically run as a scheduled job)
   * POST /recommendations/calculate-similarity
   */
  @Post('calculate-similarity')
  @HttpCode(HttpStatus.OK)
  async calculateUserSimilarity() {
    return this.recommendationsService.calculateUserSimilarity();
  }
}
