import { Controller, Post, Body, UploadedFile, UseInterceptors } from '@nestjs/common';
import { AdvancedSearchService } from './advanced-search.service';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('search')
export class SearchController {
  constructor(private readonly svc: AdvancedSearchService) {}

  @Post()
  search(@Body() body: { filters: any; sort?: string }) {
    return this.svc.search(body);
  }

  @Post('image')
  @UseInterceptors(FileInterceptor('file'))
  image(@UploadedFile() file: Express.Multer.File) {
    return this.svc.imageSearch(file.buffer);
  }
}
