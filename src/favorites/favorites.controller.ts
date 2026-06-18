import { Controller, Post, Get, Param, ParseUUIDPipe, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { FavoritesService } from './favorites.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@ApiTags('Favorites')
@UseGuards(JwtAuthGuard)
@Controller('favorites')
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @ApiOperation({ summary: 'Toggle product favorite status' })
  @ApiParam({ name: 'productId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'State successfully flipped.' })
  @Post(':productId')
  async toggle(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Request() req,
  ): Promise<{ favorited: boolean }> {
    return this.favoritesService.toggle(req.user.id, productId);
  }

  @ApiOperation({ summary: 'Get all user favorites' })
  @ApiResponse({ status: 200, description: 'Array of favorited product UUID strings returned.' })
  @Get()
  async findAll(@Request() req): Promise<string[]> {
    return this.favoritesService.findAllForUser(req.user.id);
  }

  @ApiOperation({ summary: 'Check if a specific product is favorited' })
  @ApiParam({ name: 'productId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Evaluation state wrapper returned.' })
  @Get(':productId')
  async isFavorite(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Request() req,
  ): Promise<{ isFavorite: boolean }> {
    return this.favoritesService.isFavorite(req.user.id, productId);
  }
}