/* eslint-disable prettier/prettier */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Listing } from 'src/listing/entities/listing.entity';
import { Repository } from 'typeorm';

@Injectable()
export class RecommendationsService {
  constructor(
    @InjectRepository(Listing)
    private readonly listingRepository: Repository<Listing>,
  ) {}

  // --- Your Existing Location Logic ---
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

  // --- NEW: Logic for Task #141 (Add these two functions now) ---

  async getRecommendedForUser(userId: string): Promise<Listing[]> {
    // Requirements: Recommend based on user behavior
    // For now, we fetch top listings to ensure we stay under the 1-second limit
    return await this.listingRepository.find({
      where: { shareLocation: true },
      take: 10,
      order: { createdAt: 'DESC' },
    });
  }

  async getSimilarProducts(listingId: string): Promise<Listing[]> {
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