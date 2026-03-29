import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createReadStream } from 'node:fs';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { Listing } from './entities/listing.entity';
import { ListingVariant } from './entities/listing-variant.entity';
import { ConfigService } from '@nestjs/config';
import { SearchSyncService } from '../search/search-sync.service';
import { parse } from 'csv-parse';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

export interface BulkListingImportRowResult {
  row: number;
  success: boolean;
  listingId?: string;
  errors: string[];
}

export interface BulkListingImportResult {
  totalRows: number;
  successCount: number;
  failureCount: number;
  rows: BulkListingImportRowResult[];
}

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

  private buildVariant(dto: Partial<ListingVariant>): ListingVariant {
    const variant = new ListingVariant();
    variant.sku = dto.sku;
    variant.attributes = dto.attributes;
    variant.price = dto.price ?? 0;
    variant.currency = dto.currency ?? 'USD';
    variant.quantity = dto.quantity ?? 1;
    variant.reserved = dto.reserved ?? 0;
    variant.available = variant.quantity - variant.reserved;
    if (variant.available < 0) {
      variant.available = 0;
    }
    return variant;
  }

  private aggregateListing(listing: Listing): Listing {
    if (listing.variants && listing.variants.length > 0) {
      const totalQuantity = listing.variants.reduce(
        (sum, variant) => sum + (variant.quantity ?? 0),
        0,
      );
      const totalReserved = listing.variants.reduce(
        (sum, variant) => sum + (variant.reserved ?? 0),
        0,
      );
      const totalAvailable = listing.variants.reduce(
        (sum, variant) => sum + (variant.available ?? 0),
        0,
      );
      const minPrice = Math.min(
        ...listing.variants.map((variant) => Number(variant.price)),
      );

      listing.quantity = totalQuantity;
      listing.reserved = totalReserved;
      listing.available = totalAvailable;
      listing.price = minPrice;
      listing.currency = listing.variants[0].currency || 'USD';
    } else {
      // preserve fallback root-level values, and compute available
      listing.available = Math.max(0, listing.quantity - listing.reserved);
    }
    return listing;
  }

  private prepareVariants(dto: CreateListingDto | UpdateListingDto): ListingVariant[] {
    if (dto.variants && dto.variants.length > 0) {
      return dto.variants.map((variantData) =>
        this.buildVariant({
          price: variantData.price,
          currency: variantData.currency,
          quantity: variantData.quantity ?? 1,
          reserved: variantData.reserved ?? 0,
          sku: variantData.sku,
          attributes: variantData.attributes,
        }),
      );
    }

    // fallback single-variant behavior for legacy payloads
    if (dto.price !== undefined) {
      return [
        this.buildVariant({
          price: dto.price,
          currency: dto.currency ?? 'USD',
          quantity: dto.quantity ?? 1,
          reserved: dto.reserved ?? 0,
        }),
      ];
    }

    return [];
  }

  async create(dto: CreateListingDto, userId: string) {
    const expiryDays = this.configService.get<number>('LISTING_EXPIRY_DAYS', 30);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + expiryDays * 24 * 60 * 60 * 1000);

    const listing = this.listingRepo.create({ ...dto, userId, expiresAt });
    const variants = this.prepareVariants(dto);
    if (variants.length > 0) {
      listing.variants = variants;
      this.aggregateListing(listing);
    }

    const saved = await this.listingRepo.save(listing);

    // Index in search service
    try {
      await this.searchSyncService.syncSingleListing(saved, 'index');
    } catch (error) {
      this.logger.warn(`Failed to index listing ${saved.id} in search: ${error.message}`);
    }

    return this.aggregateListing(saved);
  }

  async importFromCsv(
    filePath: string,
    userId: string,
  ): Promise<BulkListingImportResult> {
    const parser = parse({
      columns: true,
      bom: true,
      trim: true,
      skip_empty_lines: true,
    });
    const stream = createReadStream(filePath);
    const records = stream.pipe(parser);

    const rows: BulkListingImportRowResult[] = [];
    let dataRow = 1;
    let successCount = 0;
    let failureCount = 0;

    for await (const record of records) {
      const csvLine = dataRow + 1;
      const dto = plainToInstance(CreateListingDto, {
        title: this.getCsvValue(record, ['title']),
        description: this.getCsvValue(record, ['description']),
        price: this.getCsvValue(record, ['price']),
        category: this.getCsvValue(record, ['category']),
        location: this.getCsvValue(record, ['location']),
      });

      const validationErrors = await validate(dto);
      if (validationErrors.length > 0) {
        const errors = validationErrors.flatMap((validationError) =>
          Object.values(validationError.constraints || {}),
        );
        rows.push({
          row: csvLine,
          success: false,
          errors,
        });
        failureCount += 1;
        dataRow += 1;
        continue;
      }

      try {
        const listing = await this.create(dto, userId);
        rows.push({
          row: csvLine,
          success: true,
          listingId: listing.id,
          errors: [],
        });
        successCount += 1;
      } catch (error) {
        rows.push({
          row: csvLine,
          success: false,
          errors: [
            error instanceof Error
              ? error.message
              : 'Unable to create listing for this row',
          ],
        });
        failureCount += 1;
      }

      dataRow += 1;
    }

    return {
      totalRows: rows.length,
      successCount,
      failureCount,
      rows,
    };
  }

  private getCsvValue(
    record: Record<string, unknown>,
    aliases: string[],
  ): unknown {
    const normalized = Object.entries(record).reduce<Record<string, unknown>>(
      (acc, [key, value]) => {
        acc[key.trim().toLowerCase()] = value;
        return acc;
      },
      {},
    );

    for (const alias of aliases) {
      const value = normalized[alias.toLowerCase()];
      if (value !== undefined) {
        return value;
      }
    }

    return undefined;
  }

  async findOne(id: string) {
    const listing = await this.listingRepo.findOne({
      where: { id },
      relations: ['variants'],
    });
    if (!listing) throw new NotFoundException('Listing not found');

    // Increment views count
    listing.views = (listing.views || 0) + 1;
    await this.listingRepo.save(listing);

    return this.aggregateListing(listing);
  }

  async update(id: string, dto: UpdateListingDto) {
    const listing = await this.findOne(id);

    if (dto.variants) {
      listing.variants = this.prepareVariants(dto);
    }

    Object.assign(listing, dto);
    this.aggregateListing(listing);

    const saved = await this.listingRepo.save(listing);

    // Update search index
    try {
      await this.searchSyncService.syncSingleListing(saved, 'update');
    } catch (error) {
      this.logger.warn(`Failed to update listing ${saved.id} in search: ${error.message}`);
    }

    return this.aggregateListing(saved);
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
    const { take, skip, category, location, minPrice, maxPrice, q } = filters;

    const now = new Date();
    const query = this.listingRepo
      .createQueryBuilder('listing')
      .leftJoin('listing.user', 'user')
      .leftJoinAndSelect('listing.variants', 'variant')
      .where('listing.isActive = :isActive', { isActive: true })
      .andWhere('listing.deletedAt IS NULL')
      .andWhere('(listing.expiresAt IS NULL OR listing.expiresAt > :now)', { now });

    if (category) {
      query.andWhere('listing.category = :category', { category });
    }

    if (location) {
      query.andWhere('listing.location ILIKE :location', { location: `%${location}%` });
    }

    if (minPrice !== undefined) {
      query.andWhere('listing.price >= :minPrice', { minPrice });
    }

    if (maxPrice !== undefined) {
      query.andWhere('listing.price <= :maxPrice', { maxPrice });
    }

    if (q) {
      query.andWhere('(listing.title ILIKE :q OR listing.description ILIKE :q)', { q: `%${q}%` });
    }

    query.orderBy('listing.createdAt', 'DESC').take(take).skip(skip);

    const [listings, total] = await query.getManyAndCount();

    return {
      listings: listings.map((l) => this.aggregateListing(l)),
      total,
    };
  }

  async findAll(page?: number, limit?: number, category?: string) {
    const take = limit || 10;
    const skip = ((page || 1) - 1) * take;

    const query = this.listingRepo
      .createQueryBuilder('listing')
      .leftJoin('listing.user', 'user')
      .leftJoinAndSelect('listing.variants', 'variant')
      .where('listing.isActive = :isActive', { isActive: true })
      .andWhere('listing.deletedAt IS NULL');

    if (category) {
      query.andWhere('listing.category = :category', { category });
    }

    query.orderBy('listing.createdAt', 'DESC').take(take).skip(skip);

    const [listings, total] = await query.getManyAndCount();
    return {
      listings: listings.map((l) => this.aggregateListing(l)),
      total,
      page: page || 1,
      limit: take,
    };
  }

  async findFeatured() {
    const listings = await this.listingRepo
      .createQueryBuilder('listing')
      .leftJoin('listing.user', 'user')
      .leftJoinAndSelect('listing.variants', 'variant')
      .where('listing.isActive = :isActive', { isActive: true })
      .andWhere('listing.deletedAt IS NULL')
      .orderBy('listing.createdAt', 'DESC')
      .take(10)
      .getMany();

    return listings.map((l) => this.aggregateListing(l));
  }

  async remove(id: string) {
    const listing = await this.findOne(id);
    await this.listingRepo.remove(listing);
    return { message: 'Listing removed successfully' };
  }
}
