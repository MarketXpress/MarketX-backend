import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, IsNull } from 'typeorm';
import { Listing } from '../listing/entities/listing.entity';

@Injectable()
export class DeletedListingsService {
  constructor(
    @InjectRepository(Listing)
    private readonly listingRepository: Repository<Listing>,
  ) {}

  async findAllDeleted(take = 10, skip = 0): Promise<{ listings: Listing[]; total: number }> {
    const [listings, total] = await this.listingRepository.findAndCount({
      withDeleted: true,
      where: {
        deletedAt: Not(IsNull()),
      },
      order: { deletedAt: 'DESC' },
      take,
      skip,
    });

    return { listings, total };
  }

  async findOneDeleted(id: string): Promise<Listing> {
    const listing = await this.listingRepository.findOne({
      where: { id },
      withDeleted: true,
    });

    if (!listing || !listing.deletedAt) {
      throw new NotFoundException(`Deleted listing with ID ${id} not found`);
    }

    return listing;
  }

  async restore(id: string): Promise<Listing> {
    const listing = await this.findOneDeleted(id);
    await this.listingRepository.restore(id);
    return this.listingRepository.findOneBy({ id });
  }
} 