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

  async create(dto: CreateListingDto, ownerId: string) {
    const listing = this.listingRepo.create({ ...dto, ownerId });
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

  async findActiveListingsPaginated(take = 10, skip = 0): Promise<{ listings: Listing[]; total: number }> {
    const [listings, total] = await this.listingRepo.findAndCount({
      where: { status: 'active' },
      order: { createdAt: 'DESC' },
      take,
      skip,
    });

    return { listings, total };
  }
}
