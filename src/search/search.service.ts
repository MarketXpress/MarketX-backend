import { Injectable } from '@nestjs/common';
import { SearchQueryDto } from './dto/search-query.dto';

@Injectable()
export class SearchService {
  async search(query: SearchQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    // Placeholder response (DB comes later)
    return {
      meta: {
        query,
        page,
        limit,
      },
      data: [],
      message: 'Search executed successfully (no data source connected yet)',
    };
  }
}
