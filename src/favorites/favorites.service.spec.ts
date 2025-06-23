import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FavoritesService } from './favorites.service';
import { User } from '../users/users.entity';
import { Listing } from '../listings/listing.entity';
import { NotFoundException, ConflictException } from '@nestjs/common';

describe('FavoritesService', () => {
  let service: FavoritesService;
  let userRepository: Repository<User>;
  let listingRepository: Repository<Listing>;

  const mockUser = {
    id: 1,
    email: 'test@example.com',
    favoriteListings: [],
  };

  const mockListing = {
    id: 1,
    title: 'Test Listing',
    description: 'Test Description',
    price: 100,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FavoritesService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Listing),
          useValue: {
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<FavoritesService>(FavoritesService);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    listingRepository = module.get<Repository<Listing>>(
      getRepositoryToken(Listing),
    );
  });

  describe('favoriteListing', () => {
    it('should successfully favorite a listing', async () => {
      const userWithFavorites = { ...mockUser, favoriteListings: [] };

      jest
        .spyOn(userRepository, 'findOne')
        .mockResolvedValue(userWithFavorites);
      jest
        .spyOn(listingRepository, 'findOne')
        .mockResolvedValue(mockListing as Listing);
      jest
        .spyOn(userRepository, 'save')
        .mockResolvedValue(userWithFavorites as unknown as User);

      await service.favoriteListing(1, 1);

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: ['favoriteListings'],
      });
      expect(listingRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(userRepository.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException when user not found', async () => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(null);

      await expect(service.favoriteListing(1, 1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when listing not found', async () => {
      jest
        .spyOn(userRepository, 'findOne')
        .mockResolvedValue(mockUser as unknown as User);
      jest.spyOn(listingRepository, 'findOne').mockResolvedValue(null);

      await expect(service.favoriteListing(1, 1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException when listing already favorited', async () => {
      const userWithFavorites = {
        ...mockUser,
        favoriteListings: [mockListing as Listing],
      };

      jest
        .spyOn(userRepository, 'findOne')
        .mockResolvedValue(userWithFavorites as User);
      jest
        .spyOn(listingRepository, 'findOne')
        .mockResolvedValue(mockListing as Listing);

      await expect(service.favoriteListing(1, 1)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('unfavoriteListing', () => {
    it('should successfully unfavorite a listing', async () => {
      const userWithFavorites = {
        ...mockUser,
        favoriteListings: [mockListing as Listing],
      };

      jest
        .spyOn(userRepository, 'findOne')
        .mockResolvedValue(userWithFavorites as User);
      jest
        .spyOn(userRepository, 'save')
        .mockResolvedValue(userWithFavorites as User);

      await service.unfavoriteListing(1, 1);

      expect(userRepository.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException when user not found', async () => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(null);

      await expect(service.unfavoriteListing(1, 1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when listing not in favorites', async () => {
      const userWithFavorites = { ...mockUser, favoriteListings: [] };

      jest
        .spyOn(userRepository, 'findOne')
        .mockResolvedValue(userWithFavorites as unknown as User);

      await expect(service.unfavoriteListing(1, 1)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
