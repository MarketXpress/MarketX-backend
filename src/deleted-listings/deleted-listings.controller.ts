import { Controller, Get, Post, Param, Query, ParseUUIDPipe } from '@nestjs/common';
import { DeletedListingsService } from './deleted-listings.service';

@Controller('deleted-listings')
export class DeletedListingsController {
  constructor(private readonly deletedListingsService: DeletedListingsService) {}

  @Get()
  findAllDeleted(
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    const parsedTake = take ? parseInt(take, 10) : 10;
    const parsedSkip = skip ? parseInt(skip, 10) : 0;
    return this.deletedListingsService.findAllDeleted(parsedTake, parsedSkip);
  }

  @Get(':id')
  findOneDeleted(@Param('id', ParseUUIDPipe) id: string) {
    return this.deletedListingsService.findOneDeleted(id);
  }

  @Post(':id/restore')
  restore(@Param('id', ParseUUIDPipe) id: string) {
    return this.deletedListingsService.restore(id);
  }
} 