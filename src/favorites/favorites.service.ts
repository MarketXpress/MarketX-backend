import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserFavorite } from './favorites.entity';

@Injectable()
export class FavoritesService {
  constructor(
    @InjectRepository(UserFavorite)
    private readonly favoritesRepository: Repository<UserFavorite>,
  ) {}

  /**
   * Toggles a product favorite state. Alternates between saving or removing the record.
   */
  async toggle(userId: string, productId: string): Promise<{ favorited: boolean }> {
    const favorite = await this.favoritesRepository.findOne({
      where: { userId, productId },
    });

    if (favorite) {
      await this.favoritesRepository.remove(favorite);
      return { favorited: false };
    }

    const newFavorite = this.favoritesRepository.create({ userId, productId });
    await this.favoritesRepository.save(newFavorite);
    return { favorited: true };
  }

  /**
   * Retrieves all product IDs favorited by a user.
   */
  async findAllForUser(userId: string): Promise<string[]> {
    const favorites = await this.favoritesRepository.find({
      where: { userId },
      select: ['productId'],
    });
    return favorites.map((fav) => fav.productId);
  }

  /**
   * Evaluates if a unique product record is currently favorited by a user.
   */
  async isFavorite(userId: string, productId: string): Promise<{ isFavorite: boolean }> {
    const count = await this.favoritesRepository.count({
      where: { userId, productId },
    });
    return { isFavorite: count > 0 };
  }
}