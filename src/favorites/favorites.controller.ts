import {
  Controller,
  Post,
  Delete,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Get,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FavoritesService } from './favorites.service';

@Controller('listings')
@UseGuards(AuthGuard('jwt'))
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Post(':id/favorite')
  @HttpCode(HttpStatus.CREATED)
  async favoriteListing(
    @Param('id') listingId: string,
    @Request() req: any,
  ): Promise<{ message: string }> {
    const userId = req.user.id;
    await this.favoritesService.favoriteListing(userId, listingId);
    return { message: 'Listing added to favorites successfully' };
  }

  @Delete(':id/favorite')
  @HttpCode(HttpStatus.OK)
  async unfavoriteListing(
    @Param('id') listingId: string,
    @Request() req: any,
  ): Promise<{ message: string }> {
    const userId = req.user.id;
    await this.favoritesService.unfavoriteListing(userId, listingId);
    return { message: 'Listing removed from favorites successfully' };
  }

  @Get('favorites')
  async getUserFavorites(@Request() req: any) {
    const userId = req.user.id;
    const favorites = await this.favoritesService.getUserFavorites(userId);
    return { favorites };
  }
}
