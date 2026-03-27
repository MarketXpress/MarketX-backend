import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { Listing } from './entities/listing.entity';
import { ConfigService } from '@nestjs/config';
import { SearchSyncService } from '../search/search-sync.service';

// NOTE: Ensure ConfigService is provided in the ListingsModule for dependency injection.
@Injectable()
export class ListingsService {
  private readonly logger = new Logger(ListingsService.name);

  constructor(
    @InjectRepository(Listing)
    private readonly listingRepo: Repository<Listing>,
    private readonly configService: ConfigService,
    private readonly searchSyncService: SearchSyncService,
  ) {}

  async create(dto: CreateListingDto, userId: string) {
    const expiryDays = this.configService.get<number>('LISTING_EXPIRY_DAYS', 30);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + expiryDays * 24 * 60 * 60 * 1000);
    const listing = this.listingRepo.create({ ...dto, userId, expiresAt });
    const saved = await this.listingRepo.save(listing);

    // Index in search service
    try {
      await this.searchSyncService.syncSingleListing(saved, 'index');
    } catch (error) {
      this.logger.warn(`Failed to index listing ${saved.id} in search: ${error.message}`);
    }

    return saved;
  }

  async findOne(id: string) {
    const listing = await this.listingRepo.findOneBy({ id });
    if (!listing) throw new NotFoundException('Listing not found');
    // Increment views count
    listing.views = (listing.views || 0) + 1;
    await this.listingRepo.save(listing);
    return listing;
  }

  async update(id: string, dto: UpdateListingDto) {
    const listing = await this.findOne(id);
    Object.assign(listing, dto);
    const saved = await this.listingRepo.save(listing);

    // Update search index
    try {
      await this.searchSyncService.syncSingleListing(saved, 'update');
    } catch (error) {
      this.logger.warn(`Failed to update listing ${saved.id} in search: ${error.message}`);
    }

    return saved;
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

    const now = new Date();
    const query = this.listingRepo
      .createQueryBuilder('listing')
      .where('listing.isActive = :isActive', { isActive: true })
      .andWhere('listing.deletedAt IS NULL')
      .andWhere('(listing.expiresAt IS NULL OR listing.expiresAt > :now)', { now });

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

  async findAll(page?: number, limit?: number, category?: string) {
    const take = limit || 10;
    const skip = ((page || 1) - 1) * take;

    const query = this.listingRepo.createQueryBuilder('listing')
      .where('listing.isActive = :isActive', { isActive: true });

    if (category) {
      query.andWhere('listing.category = :category', { category });
    }

    query.orderBy('listing.createdAt', 'DESC')
      .take(take)
      .skip(skip);

    const [listings, total] = await query.getManyAndCount();
    return { listings, total, page: page || 1, limit: take };
  }

  async findFeatured() {
    return this.listingRepo.find({
      where: { isActive: true },
      order: { createdAt: 'DESC' },
      take: 10,
    });
  }

  async remove(id: string) {
    const listing = await this.findOne(id);
    await this.listingRepo.remove(listing);
    return { message: 'Listing removed successfully' };
  }
}
