import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';

@Controller('listing')
export class ListingController {
  @Get()
  findAll() {
    return { message: 'Get all listings' };
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return { message: `Get listing with id: ${id}` };
  }

  @Post()
  create(@Body() createListingDto: any) {
    return { message: 'Create new listing', data: createListingDto };
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updateListingDto: any) {
    return { 
      message: `Update listing with id: ${id}`, 
      data: updateListingDto 
    };
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return { message: `Delete listing with id: ${id}` };
  }
}
