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
}
