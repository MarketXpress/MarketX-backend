import { Test, TestingModule } from '@nestjs/testing';
import { FavoritesController } from './favorites.controller';
import { FavoritesService } from './favorites.service';

describe('FavoritesController', () => {
  let controller: FavoritesController;
  let favoritesService: FavoritesService;

  const mockRequest = {
    user: { id: 1 },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FavoritesController],
      providers: [
        {
          provide: FavoritesService,
          useValue: {
            favoriteListing: jest.fn(),
            unfavoriteListing: jest.fn(),
            getUserFavorites: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<FavoritesController>(FavoritesController);
    favoritesService = module.get<FavoritesService>(FavoritesService);
  });

  describe('favoriteListing', () => {
    it('should favorite a listing successfully', async () => {
      jest.spyOn(favoritesService, 'favoriteListing').mockResolvedValue();

      const result = await controller.favoriteListing('1', mockRequest);

      expect(favoritesService.favoriteListing).toHaveBeenCalledWith(1, 1);
      expect(result).toEqual({ message: 'Listing added to favorites successfully' });
    });
  });

  describe('unfavoriteListing', () => {
    it('should unfavorite a listing successfully', async () => {
      jest.spyOn(favoritesService, 'unfavoriteListing').mockResolvedValue();

      const result = await controller.unfavoriteListing('1', mockRequest);

      expect(favoritesService.unfavoriteListing).toHaveBeenCalledWith(1, 1);
      expect(result).toEqual({ message: 'Listing removed from favorites successfully' });
    });
  });

  describe('getUserFavorites', () => {
    it('should return user favorites', async () => {
      const mockFavorites = [{ id: 1, title: 'Test Listing' }];
      jest.spyOn(favoritesService, 'getUserFavorites').mockResolvedValue(mockFavorites as any);

      const result = await controller.getUserFavorites(mockRequest);

      expect(favoritesService.getUserFavorites).toHaveBeenCalledWith(1);
      expect(result).toEqual({ favorites: mockFavorites });
    });
  });
});