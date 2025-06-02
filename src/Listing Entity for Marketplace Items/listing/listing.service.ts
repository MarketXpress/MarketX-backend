import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Listing } from '../entities/listing.entity';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';

@Injectable()
export class ListingService {
  constructor(
    @InjectRepository(Listing)
    private readonly listingRepository: Repository<Listing>,
  ) {}

  async create(createListingDto: CreateListingDto): Promise<Listing> {
    const listing = this.listingRepository.create(createListingDto);
    return await this.listingRepository.save(listing);
  }

  async findAll(): Promise<Listing[]> {
    return await this.listingRepository.find({
      relations: ['user'],
      where: { isActive: true },
    });
  }

  async findOne(id: string): Promise<Listing> {
    const listing = await this.listingRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!listing) {
      throw new NotFoundException(`Listing with ID ${id} not found`);
    }

    return listing;
  }

  async findByUser(userId: string): Promise<Listing[]> {
    return await this.listingRepository.find({
      where: { userId },
      relations: ['user'],
    });
  }

  async update(id: string, updateListingDto: UpdateListingDto): Promise<Listing> {
    const listing = await this.findOne(id);
    
    Object.assign(listing, updateListingDto);
    
    return await this.listingRepository.save(listing);
  }

  async remove(id: string): Promise<void> {
    const listing = await this.findOne(id);
    await this.listingRepository.remove(listing);
  }

  async deactivate(id: string): Promise<Listing> {
    const listing = await this.findOne(id);
    listing.isActive = false;
    return await this.listingRepository.save(listing);
  }
}
