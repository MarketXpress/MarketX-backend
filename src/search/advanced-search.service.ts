// src/search/advanced-search.service.ts
import { Injectable } from '@nestjs/common';
import { SearchFiltersService } from './search-filters.service';
import { CustomSortType } from './types';
import { SearchResult, clusterResults } from './utils/search-helpers';
import { MLService } from '../ai/ml.service';
import { ImageRecognitionService } from '../ai/image-recognition.service';

@Injectable()
export class AdvancedSearchService {
  constructor(
    private readonly filters: SearchFiltersService,
    private readonly ml: MLService,
    private readonly imgRec: ImageRecognitionService,
  ) {}

  async search(query: { filters: any; sort?: CustomSortType }): Promise<SearchResult[]> {
    const filtered = await this.filters.applyFilters(query.filters);
    const sorted = this.applySorting(filtered, query.sort || 'relevance');
    return clusterResults(sorted);
  }

  async imageSearch(imageBuffer: Buffer, topK = 5): Promise<SearchResult[]> {
    const ids = await this.imgRec.searchSimilar(imageBuffer, topK);
    const items = await this.filters.findByIds(ids);
    return items.map(i => ({ ...i, similarity: undefined }));
  }

  private applySorting(data: SearchResult[], type: CustomSortType): SearchResult[] {
    switch (type) {
      case 'popularity':
        return data.sort((a, b) => b.popularity - a.popularity);
      case 'distance':
        return data.sort((a, b) => a.distance - b.distance);
      case 'relevance':
      default:
        return this.ml.rankByRelevance(data);
    }
  }
}
