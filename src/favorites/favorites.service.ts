import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Listing } from 'src/listing/entities/listing.entity';
import { Users } from 'src/users/users.entity';

@Injectable()
export class FavoritesService {
  constructor(
    @InjectRepository(Users)
    private readonly userRepository: Repository<Users>,

    @InjectRepository(Listing)
    private readonly listingRepository: Repository<Listing>,
  ) {}

  async favoriteListing(userId: number, listingId: string): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['favoriteListings'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const listing = await this.listingRepository.findOne({
      where: { id: listingId },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    const isAlreadyFavorited = user.favoriteListings.some(
      (favListing) => favListing.id === listingId,
    );

    if (isAlreadyFavorited) {
      throw new ConflictException('Listing is already favorited');
    }

    user.favoriteListings.push(listing);
    await this.userRepository.save(user);
  }

  async unfavoriteListing(userId: number, listingId: string): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['favoriteListings'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const index = user.favoriteListings.findIndex(
      (fav) => fav.id === listingId,
    );

    if (index === -1) {
      throw new NotFoundException('Listing not found in favorites');
    }

    user.favoriteListings.splice(index, 1);
    await this.userRepository.save(user);
  }

  async getUserFavorites(userId: number): Promise<Listing[]> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['favoriteListings'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user.favoriteListings;
  }

  async isListingFavorited(
    userId: number,
    listingId: string,
  ): Promise<boolean> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['favoriteListings'],
    });

    if (!user) {
      return false;
    }

    return user.favoriteListings.some((fav) => fav.id === listingId);
  }
}
