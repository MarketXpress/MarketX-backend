/* eslint-disable prettier/prettier */
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Listing } from '../listing/entities/listing.entity';
import {
  BrowsingHistory,
  PurchaseHistory,
  FrequentlyBoughtTogether,
  UserSimilarity,
} from './entities';
import { CacheService } from '../cache/cache.service';
import {
  TrackViewDto,
  AddToCartDto,
  GetRecommendationsDto,
  GetSimilarProductsDto,
  GetFrequentlyBoughtTogetherDto,
} from './dto/recommendation.dto';

@Injectable()
export class RecommendationsService {
  private readonly logger = new Logger(RecommendationsService.name);
  private readonly CACHE_TTL = 3600; // 1 hour
  private readonly CACHE_TTL_SHORT = 300; // 5 minutes

  constructor(
    @InjectRepository(Listing)
    private readonly listingRepository: Repository<Listing>,
    @InjectRepository(BrowsingHistory)
    private readonly browsingHistoryRepository: Repository<BrowsingHistory>,
    @InjectRepository(PurchaseHistory)
    private readonly purchaseHistoryRepository: Repository<PurchaseHistory>,
    @InjectRepository(FrequentlyBoughtTogether)
    private readonly frequentlyBoughtTogetherRepository: Repository<FrequentlyBoughtTogether>,
    @InjectRepository(UserSimilarity)
    private readonly userSimilarityRepository: Repository<UserSimilarity>,
    private readonly cacheService: CacheService,
  ) {}

  // ==================== EXISTING NEARBY LOGIC ====================

  async findNearbyListings(
    userLat: number,
    userLng: number,
    maxDistanceInMeters: number,
  ): Promise<(Listing & { distance: number })[]> {
    const rawResults = await this.listingRepository
      .createQueryBuilder('listing')
      .select([
        'listing',
        `ST_Distance(listing.location, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)) as distance`,
      ])
      .where(
        `ST_DWithin(
          listing.location,
          ST_SetSRID(ST_MakePoint(:lng, :lat), 4326),
          :maxDistance
        )`,
      )
      .andWhere('listing.shareLocation = true')
      .orderBy('distance', 'ASC')
      .setParameters({
        lat: userLat,
        lng: userLng,
        maxDistance: maxDistanceInMeters,
      })
      .getRawAndEntities();

    return rawResults.entities.map((listing, i) => ({
      ...listing,
      distance: parseFloat(rawResults.raw[i].distance),
    }));
  }

  // ==================== BROWSING HISTORY TRACKING ====================

  /**
   * Track a user's view of a product
   */
  async trackView(trackViewDto: TrackViewDto): Promise<BrowsingHistory> {
    const { userId, listingId, viewDuration = 0 } = trackViewDto;

    // Check if there's a recent view (within last hour) to update
    const recentView = await this.browsingHistoryRepository.findOne({
      where: {
        userId,
        listingId,
      },
      order: { viewedAt: 'DESC' },
    });

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    if (recentView && recentView.viewedAt > oneHourAgo) {
      // Update existing view duration
      recentView.viewDuration += viewDuration;
      return this.browsingHistoryRepository.save(recentView);
    }

    // Create new browsing history entry
    const browsingHistory = this.browsingHistoryRepository.create({
      userId,
      listingId,
      viewDuration,
      addedToCart: false,
      purchased: false,
    });

    const saved = await this.browsingHistoryRepository.save(browsingHistory);
    this.logger.log(`Tracked view for user ${userId} on listing ${listingId}`);

    // Invalidate user's recommendation cache
    await this.cacheService.delete(`recommendations:user:${userId}`);

    return saved;
  }

  /**
   * Track when a user adds a product to cart
   */
  async trackAddToCart(addToCartDto: AddToCartDto): Promise<BrowsingHistory> {
    const { userId, listingId } = addToCartDto;

    const recentView = await this.browsingHistoryRepository.findOne({
      where: { userId, listingId },
      order: { viewedAt: 'DESC' },
    });

    if (recentView) {
      recentView.addedToCart = true;
      return this.browsingHistoryRepository.save(recentView);
    }

    // Create new entry if not exists
    const browsingHistory = this.browsingHistoryRepository.create({
      userId,
      listingId,
      addedToCart: true,
      purchased: false,
    });

    return this.browsingHistoryRepository.save(browsingHistory);
  }

  /**
   * Record a purchase for recommendations
   */
  async recordPurchase(
    userId: string,
    orderId: string,
    items: Array<{ listingId: string; quantity: number; price: number; currency: string }>,
  ): Promise<void> {
    // Record each item in purchase history
    for (const item of items) {
      const purchaseHistory = this.purchaseHistoryRepository.create({
        userId,
        orderId,
        listingId: item.listingId,
        quantity: item.quantity,
        price: item.price,
        currency: item.currency,
      });
      await this.purchaseHistoryRepository.save(purchaseHistory);

      // Update browsing history
      const recentView = await this.browsingHistoryRepository.findOne({
        where: { userId, listingId: item.listingId },
      });
      if (recentView) {
        recentView.purchased = true;
        await this.browsingHistoryRepository.save(recentView);
      }
    }

    // Update frequently bought together
    await this.updateFrequentlyBoughtTogether(items);

    // Invalidate recommendation caches
    await this.cacheService.delete(`recommendations:user:${userId}`);
    for (const item of items) {
      await this.cacheService.delete(`recommendations:similar:${item.listingId}`);
      await this.cacheService.delete(`recommendations:fbt:${item.listingId}`);
    }

    this.logger.log(`Recorded purchase for user ${userId}, order ${orderId}`);
  }

  // ==================== PERSONALIZED RECOMMENDATIONS ====================

  /**
   * Get personalized recommendations for a user based on:
   * - Browsing history
   * - Purchase history
   * - Collaborative filtering
   */
  async getRecommendedForUser(dto: GetRecommendationsDto): Promise<Listing[]> {
    const { userId, limit = 10 } = dto;

    // Try to get from cache
    const cacheKey = `recommendations:user:${userId}:${limit}`;
    const cached = await this.cacheService.get<Listing[]>(cacheKey);
    if (cached) {
      this.logger.log(`Cache hit for recommendations:user:${userId}`);
      return cached;
    }

    // Get recommendations using multiple strategies
    const recommendations = await this.generatePersonalizedRecommendations(userId, limit);

    // Cache the results
    await this.cacheService.set(cacheKey, recommendations, { ttl: this.CACHE_TTL });

    return recommendations;
  }

  /**
   * Generate personalized recommendations using hybrid approach:
   * 1. Content-based: Items similar to browsed/purchased items
   * 2. Collaborative filtering: Items bought by similar users
   */
  private async generatePersonalizedRecommendations(
    userId: string,
    limit: number,
  ): Promise<Listing[]> {
    // Get user's browsing and purchase history
    const browsedListings = await this.browsingHistoryRepository.find({
      where: { userId },
      order: { viewedAt: 'DESC' },
      take: 20,
    });

    const purchasedListings = await this.purchaseHistoryRepository.find({
      where: { userId },
      order: { purchasedAt: 'DESC' },
      take: 20,
    });

    const browsedIds = browsedListings.map((b) => b.listingId);
    const purchasedIds = purchasedListings.map((p) => p.listingId);
    const allRelevantIds = [...new Set([...browsedIds, ...purchasedIds])];

    // Strategy 1: Get similar items based on categories of browsed/purchased items
    const categoryScores = new Map<string, number>();
    for (const view of browsedListings) {
      const listing = await this.listingRepository.findOne({
        where: { id: view.listingId },
      });
      if (listing?.category) {
        const score = (categoryScores.get(listing.category) || 0) + (view.purchased ? 3 : 1);
        categoryScores.set(listing.category, score);
      }
    }

    // Strategy 2: Collaborative filtering - find similar users
    const collaborativeRecommendations = await this.getCollaborativeRecommendations(userId, limit);

    // Strategy 3: Content-based recommendations
    let contentBasedRecommendations: Listing[] = [];
    if (allRelevantIds.length > 0) {
      // Get categories and tags from viewed/purchased items
      const categories = Array.from(categoryScores.keys());
      
      if (categories.length > 0) {
        contentBasedRecommendations = await this.listingRepository
          .createQueryBuilder('listing')
          .where('listing.category IN (:...categories)', { categories })
          .andWhere('listing.id NOT IN (:...excludedIds)', { excludedIds: allRelevantIds })
          .andWhere('listing.isActive = :isActive', { isActive: true })
          .orderBy('listing.createdAt', 'DESC')
          .take(limit * 2)
          .getMany();
      }
    }

    // Combine and rank recommendations
    const recommendationMap = new Map<string, { listing: Listing; score: number }>();

    // Add content-based with scores based on category relevance
    for (const listing of contentBasedRecommendations) {
      const categoryScore = categoryScores.get(listing.category) || 0;
      const isPurchased = purchasedIds.includes(listing.id);
      const isBrowsed = browsedIds.includes(listing.id);
      
      let score = categoryScore;
      if (!isPurchased && !isBrowsed) score += 1; // Bonus for new items
      if (!isPurchased) score += 2; // Extra bonus for unpurchased

      recommendationMap.set(listing.id, { listing, score });
    }

    // Add collaborative recommendations with scores
    for (const rec of collaborativeRecommendations) {
      const existing = recommendationMap.get(rec.id);
      if (existing) {
        existing.score += rec['collaborativeScore'] || 0;
      } else {
        recommendationMap.set(rec.id, { 
          listing: rec, 
          score: rec['collaborativeScore'] || 0 
        });
      }
    }

    // Sort by score and return top results
    const ranked = Array.from(recommendationMap.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((r) => r.listing);

    // If not enough recommendations, add popular items
    if (ranked.length < limit) {
      const purchasedSet = new Set([...purchasedIds, ...ranked.map((l) => l.id)]);
      const popular = await this.listingRepository
        .createQueryBuilder('listing')
        .where('listing.id NOT IN (:...exclude)', { exclude: Array.from(purchasedSet) })
        .andWhere('listing.isActive = :isActive', { isActive: true })
        .orderBy('listing.views', 'DESC')
        .take(limit - ranked.length)
        .getMany();
      
      ranked.push(...popular);
    }

    return ranked;
  }

  // ==================== COLLABORATIVE FILTERING ====================

  /**
   * Get recommendations based on what similar users purchased
   */
  private async getCollaborativeRecommendations(
    userId: string,
    limit: number,
  ): Promise<Listing[]> {
    // Find similar users
    const similarUsers = await this.userSimilarityRepository.find({
      where: [
        { userIdA: userId },
        { userIdB: userId },
      ],
      order: { similarityScore: 'DESC' },
      take: 10,
    });

    if (similarUsers.length === 0) {
      return [];
    }

    // Get user IDs of similar users
    const similarUserIds = similarUsers.map((s) =>
      s.userIdA === userId ? s.userIdB : s.userIdA,
    );

    // Get what similar users purchased that this user hasn't
    const userPurchased = await this.purchaseHistoryRepository
      .createQueryBuilder('ph')
      .select('ph.listingId')
      .distinct(true)
      .where('ph.userId = :userId', { userId })
      .getRaw();

    const userPurchasedIds = userPurchased.map((p: any) => p.listingId);

    // Get items purchased by similar users
    const similarPurchases = await this.purchaseHistoryRepository
      .createQueryBuilder('ph')
      .innerJoin(UserSimilarity, 'us', 
        '(us.userIdA = ph.userId AND us.userIdB = :userId) OR (us.userIdB = ph.userId AND us.userIdA = :userId)',
        { userId }
      )
      .where('ph.userId IN (:...similarUserIds)', { similarUserIds })
      .andWhere(userPurchasedIds.length > 0 ? 'ph.listingId NOT IN (:...userPurchasedIds)' : '1=1', {
        userPurchasedIds,
      })
      .orderBy('us.similarityScore', 'DESC')
      .addOrderBy('ph.purchasedAt', 'DESC')
      .take(limit * 2)
      .getMany();

    const listingIds = [...new Set(similarPurchases.map((p) => p.listingId))];

    if (listingIds.length === 0) {
      return [];
    }

    const listings = await this.listingRepository.find({
      where: { id: In(listingIds), isActive: true },
    });

    // Add collaborative score to each listing
    const listingsWithScore = listings.map((l) => {
      const purchase = similarPurchases.find((p) => p.listingId === l.id);
      const similarity = similarUsers.find(
        (s) => s.userIdA === purchase?.userId || s.userIdB === purchase?.userId,
      );
      return {
        ...l,
        collaborativeScore: similarity?.similarityScore || 0,
      };
    });

    return listingsWithScore.sort((a, b) => 
      (b['collaborativeScore'] || 0) - (a['collaborativeScore'] || 0)
    );
  }

  /**
   * Calculate user similarity based on purchase history
   * This would typically be run as a scheduled job
   */
  async calculateUserSimilarity(): Promise<void> {
    this.logger.log('Calculating user similarity for collaborative filtering');

    const users = await this.purchaseHistoryRepository
      .createQueryBuilder('ph')
      .select('ph.userId')
      .distinct(true)
      .getRaw();

    const userIds = users.map((u: any) => u.userId);

    for (let i = 0; i < userIds.length; i++) {
      for (let j = i + 1; j < userIds.length; j++) {
        const userA = userIds[i];
        const userB = userIds[j];

        // Get common purchases
        const purchasesA = await this.purchaseHistoryRepository.find({
          where: { userId: userA },
        });
        const purchasesB = await this.purchaseHistoryRepository.find({
          where: { userId: userB },
        });

        const itemsA = new Set(purchasesA.map((p) => p.listingId));
        const itemsB = new Set(purchasesB.map((p) => p.listingId));

        const commonPurchases = [...itemsA].filter((x) => itemsB.has(x)).length;

        if (commonPurchases > 0) {
          // Calculate cosine similarity
          const unionSize = new Set([...itemsA, ...itemsB]).size;
          const similarity = commonPurchases / unionSize;

          // Save or update similarity
          const existing = await this.userSimilarityRepository.findOne({
            where: [
              { userIdA: userA, userIdB: userB },
              { userIdA: userB, userIdB: userA },
            ],
          });

          if (existing) {
            existing.similarityScore = similarity;
            existing.commonPurchases = commonPurchases;
            await this.userSimilarityRepository.save(existing);
          } else {
            await this.userSimilarityRepository.save({
              userIdA: userA,
              userIdB: userB,
              similarityScore: similarity,
              commonPurchases,
              commonViews: 0,
            });
          }
        }
      }
    }

    this.logger.log('User similarity calculation completed');
  }

  // ==================== SIMILAR PRODUCTS ====================

  /**
   * Get similar products based on category and other attributes
   */
  async getSimilarProducts(dto: GetSimilarProductsDto): Promise<Listing[]> {
    const { listingId, limit = 5 } = dto;

    // Try cache first
    const cacheKey = `recommendations:similar:${listingId}:${limit}`;
    const cached = await this.cacheService.get<Listing[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const original = await this.listingRepository.findOne({
      where: { id: listingId },
    });
    if (!original) {
      return [];
    }

    // Find similar products in same category
    const similar = await this.listingRepository
      .createQueryBuilder('listing')
      .where('listing.category = :category', { category: original.category })
      .andWhere('listing.id != :id', { id: listingId })
      .andWhere('listing.isActive = :isActive', { isActive: true })
      .orderBy('listing.createdAt', 'DESC')
      .take(limit)
      .getMany();

    // Cache the results
    await this.cacheService.set(cacheKey, similar, { ttl: this.CACHE_TTL });

    return similar;
  }

  // ==================== FREQUENTLY BOUGHT TOGETHER ====================

  /**
   * Get frequently bought together items
   */
  async getFrequentlyBoughtTogether(
    dto: GetFrequentlyBoughtTogetherDto,
  ): Promise<Listing[]> {
    const { listingId, limit = 5 } = dto;

    // Try cache first
    const cacheKey = `recommendations:fbt:${listingId}:${limit}`;
    const cached = await this.cacheService.get<Listing[]>(cacheKey);
    if (cached) {
      return cached;
    }

    // Get items frequently bought together
    const fbtItems = await this.frequentlyBoughtTogetherRepository.find({
      where: [
        { listingIdA: listingId },
        { listingIdB: listingId },
      ],
      order: { confidence: 'DESC', purchaseCount: 'DESC' },
      take: limit,
    });

    if (fbtItems.length === 0) {
      // Fallback: get items from same category that are popular
      const listing = await this.listingRepository.findOne({
        where: { id: listingId },
      });

      if (!listing) return [];

      const fallback = await this.listingRepository
        .createQueryBuilder('listing')
        .where('listing.category = :category', { category: listing.category })
        .andWhere('listing.id != :id', { id: listingId })
        .andWhere('listing.isActive = :isActive', { isActive: true })
        .orderBy('listing.views', 'DESC')
        .take(limit)
        .getMany();

      await this.cacheService.set(cacheKey, fallback, { ttl: this.CACHE_TTL_SHORT });
      return fallback;
    }

    // Get the listing IDs
    const relatedIds = fbtItems.map((f) =>
      f.listingIdA === listingId ? f.listingIdB : f.listingIdA,
    );

    const listings = await this.listingRepository.find({
      where: { id: In(relatedIds), isActive: true },
    });

    // Sort by the order in fbtItems
    const sortedListings = relatedIds
      .map((id) => listings.find((l) => l.id === id))
      .filter(Boolean) as Listing[];

    // Cache the results
    await this.cacheService.set(cacheKey, sortedListings, { ttl: this.CACHE_TTL });

    return sortedListings;
  }

  /**
   * Update frequently bought together after a purchase
   */
  private async updateFrequentlyBoughtTogether(
    items: Array<{ listingId: string; quantity: number }>,
  ): Promise<void> {
    if (items.length < 2) return;

    // For each pair of items
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const itemA = items[i].listingId;
        const itemB = items[j].listingId;

        // Check if relationship exists
        let existing = await this.frequentlyBoughtTogetherRepository.findOne({
          where: [
            { listingIdA: itemA, listingIdB: itemB },
            { listingIdA: itemB, listingIdB: itemA },
          ],
        });

        if (existing) {
          existing.purchaseCount += 1;
          // Recalculate confidence (simple moving average)
          existing.confidence = parseFloat(
            ((existing.confidence * (existing.purchaseCount - 1) + 1) / existing.purchaseCount).toFixed(2),
          );
          await this.frequentlyBoughtTogetherRepository.save(existing);
        } else {
          await this.frequentlyBoughtTogetherRepository.save({
            listingIdA: itemA,
            listingIdB: itemB,
            purchaseCount: 1,
            confidence: 0.5, // Initial confidence for first purchase
          });
        }
      }
    }
  }

  // ==================== LEGACY METHODS ====================

  async getRecommendedForUserLegacy(userId: string): Promise<Listing[]> {
    // Requirements: Recommend based on user behavior
    // For now, we fetch top listings to ensure we stay under the 1-second limit
    return await this.listingRepository.find({
      where: { shareLocation: true },
      take: 10,
      order: { createdAt: 'DESC' },
    });
  }

  async getSimilarProductsLegacy(listingId: string): Promise<Listing[]> {
    const original = await this.listingRepository.findOne({ where: { id: listingId } });
    if (!original) return [];

    // Requirements: Suggest similar products on product pages
    return await this.listingRepository
      .createQueryBuilder('listing')
      .where('listing.category = :category', { category: original.category })
      .andWhere('listing.id != :id', { id: listingId })
      .limit(5)
      .getMany();
  }
}
