import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { Listing } from './entities/listing.entity';

@Injectable()
export class ListingsService {
  constructor(
    @InjectRepository(Listing)
    private readonly listingRepo: Repository<Listing>,
  ) {}

  async create(dto: CreateListingDto, userId: string) {
    const listing = this.listingRepo.create({ ...dto, userId });
    return await this.listingRepo.save(listing);
  }

  async findOne(id: string) {
    const listing = await this.listingRepo.findOneBy({ id });
    if (!listing) throw new NotFoundException('Listing not found');
    return listing;
  }

  async update(id: string, dto: UpdateListingDto) {
    const listing = await this.findOne(id);
    Object.assign(listing, dto);
    return await this.listingRepo.save(listing);
  }

  async delete(id: string) {
    const listing = await this.findOne(id);
    await this.listingRepo.remove(listing);
    return { message: 'Listing deleted' };
  }

  async findActiveListingsPaginated(filters: {
    take: number;
    skip: number;
    category?: string;
    location?: string;
    minPrice?: number;
    maxPrice?: number;
    q?: string;
  }): Promise<{ listings: Listing[]; total: number }> {
    const {
      take,
      skip,
      category,
      location,
      minPrice,
      maxPrice,
      q,
    } = filters;

    const query = this.listingRepo
      .createQueryBuilder('listing')
      .where('listing.isActive = :isActive', { isActive: true })
      .andWhere('listing.deletedAt IS NULL');

    if (category) {
      query.andWhere('listing.category = :category', { category });
    }

    if (location) {
      query.andWhere('listing.location ILIKE :location', {
        location: `%${location}%`,
      });
    }

    if (minPrice !== undefined) {
      query.andWhere('listing.price >= :minPrice', { minPrice });
    }

    if (maxPrice !== undefined) {
      query.andWhere('listing.price <= :maxPrice', { maxPrice });
    }

    if (q) {
      query.andWhere(
        '(listing.title ILIKE :q OR listing.description ILIKE :q)',
        { q: `%${q}%` },
      );
    }

    query.orderBy('listing.createdAt', 'DESC');
    query.take(take);
    query.skip(skip);

    const [listings, total] = await query.getManyAndCount();

    return { listings, total };
  }
}
