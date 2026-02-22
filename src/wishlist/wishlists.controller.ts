import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  Request,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { WishlistsService } from './wishlists.service';
import {
  CreateWishlistDto,
  UpdateWishlistDto,
  AddWishlistItemDto,
  UpdateWishlistItemDto,
} from './dtos/wishlist.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * All routes under /wishlists are authenticated.
 * The public share route /wishlists/share/:token is unauthenticated.
 */
@UseGuards(JwtAuthGuard)
@Controller('wishlists')
export class WishlistsController {
  constructor(private readonly wishlistsService: WishlistsService) {}

  @Get('share/:token')
  getSharedWishlist(@Param('token') token: string) {
    return this.wishlistsService.findPublicByToken(token);
  }

  /** POST /wishlists */
  @Post()
  create(@Request() req, @Body() dto: CreateWishlistDto) {
    const userId = req.user?.id ?? 'dev-user'; // replace with real auth
    return this.wishlistsService.create(userId, dto);
  }

  /** GET /wishlists */
  @Get()
  findAll(@Request() req) {
    const userId = req.user?.id ?? 'dev-user';
    return this.wishlistsService.findAllByUser(userId);
  }

  /** GET /wishlists/:id */
  @Get(':id')
  findOne(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
    const userId = req.user?.id ?? 'dev-user';
    return this.wishlistsService.findOne(userId, id);
  }

  /** PATCH /wishlists/:id */
  @Patch(':id')
  update(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWishlistDto,
  ) {
    const userId = req.user?.id ?? 'dev-user';
    return this.wishlistsService.update(userId, id, dto);
  }

  /** DELETE /wishlists/:id */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
    const userId = req.user?.id ?? 'dev-user';
    return this.wishlistsService.remove(userId, id);
  }

  /** POST /wishlists/:id/share — generate public share link */
  @Post(':id/share')
  share(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
    const userId = req.user?.id ?? 'dev-user';
    return this.wishlistsService.toggleShare(userId, id, true);
  }

  /** DELETE /wishlists/:id/share — revoke public share link */
  @Delete(':id/share')
  unshare(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
    const userId = req.user?.id ?? 'dev-user';
    return this.wishlistsService.toggleShare(userId, id, false);
  }

  /** POST /wishlists/:id/items */
  @Post(':id/items')
  addItem(
    @Request() req,
    @Param('id', ParseUUIDPipe) wishlistId: string,
    @Body() dto: AddWishlistItemDto,
  ) {
    const userId = req.user?.id ?? 'dev-user';
    return this.wishlistsService.addItem(userId, wishlistId, dto);
  }

  /** PATCH /wishlists/:id/items/:itemId */
  @Patch(':id/items/:itemId')
  updateItem(
    @Request() req,
    @Param('id', ParseUUIDPipe) wishlistId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: UpdateWishlistItemDto,
  ) {
    const userId = req.user?.id ?? 'dev-user';
    return this.wishlistsService.updateItem(userId, wishlistId, itemId, dto);
  }

  /** DELETE /wishlists/:id/items/:itemId */
  @Delete(':id/items/:itemId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeItem(
    @Request() req,
    @Param('id', ParseUUIDPipe) wishlistId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    const userId = req.user?.id ?? 'dev-user';
    return this.wishlistsService.removeItem(userId, wishlistId, itemId);
  }
}