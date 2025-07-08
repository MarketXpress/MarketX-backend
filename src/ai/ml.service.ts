
import { Injectable } from '@nestjs/common';
import { SearchResult } from '../search/utils/search-helpers';

@Injectable()
export class MLService {
  rankByRelevance(data: SearchResult[]): SearchResult[] {

    return data.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
  }
}
