import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Listing } from 'src/listing/entities/listing.entities';
import {
  Repository,
  Not,
  IsNull,
  FindOptionsWhere,
  FindOptionsOrder,
} from 'typeorm';

@Injectable()
export class DeletedListingsService {
  constructor(
    @InjectRepository(Listing)
    private readonly listingRepository: Repository<Listing>,
  ) {}

  async findAllDeleted(
    take = 10,
    skip = 0,
  ): Promise<{ listings: Listing[]; total: number }> {
    const where: FindOptionsWhere<Listing> = {
      deletedAt: Not(IsNull()),
    };

    const order: FindOptionsOrder<Listing> = {
      deletedAt: 'DESC',
    };

    const [listings, total] = await this.listingRepository.findAndCount({
      withDeleted: true,
      where,
      order,
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
    const deletedListing = await this.findOneDeleted(id);
    await this.listingRepository.restore(id);

    const restored = await this.listingRepository.findOneBy({ id });
    if (!restored) {
      throw new NotFoundException(
        `Listing with ID ${id} could not be restored`,
      );
    }

    return restored;
  }
}
