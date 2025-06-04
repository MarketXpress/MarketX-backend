import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { Listing } from '../listings/listing.entity';

@Injectable()
export class FavoritesService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Listing)
    private listingRepository: Repository<Listing>,
  ) {}

  async favoriteListing(userId: number, listingId: number): Promise<void> {
    // Find user with their favorite listings
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['favoriteListings'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Find the listing
    const listing = await this.listingRepository.findOne({
      where: { id: listingId },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    // Check if listing is already favorited
    const isAlreadyFavorited = user.favoriteListings.some(
      (favListing) => favListing.id === listingId,
    );

    if (isAlreadyFavorited) {
      throw new ConflictException('Listing is already favorited');
    }

    // Add listing to favorites
    user.favoriteListings.push(listing);
    await this.userRepository.save(user);
  }

  async unfavoriteListing(userId: number, listingId: number): Promise<void> {
    // Find user with their favorite listings
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['favoriteListings'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if listing is in favorites
    const favoriteIndex = user.favoriteListings.findIndex(
      (listing) => listing.id === listingId,
    );

    if (favoriteIndex === -1) {
      throw new NotFoundException('Listing not found in favorites');
    }

    // Remove listing from favorites
    user.favoriteListings.splice(favoriteIndex, 1);
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

  async isListingFavorited(userId: number, listingId: number): Promise<boolean> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['favoriteListings'],
    });

    if (!user) {
      return false;
    }

    return user.favoriteListings.some((listing) => listing.id === listingId);
  }
}