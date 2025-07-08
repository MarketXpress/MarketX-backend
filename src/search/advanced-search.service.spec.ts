
import { Test, TestingModule } from '@nestjs/testing';
import { AdvancedSearchService } from './advanced-search.service';
import { SearchFiltersService } from './search-filters.service';
import { MLService } from '../ai/ml.service';
import { ImageRecognitionService } from '../ai/image-recognition.service';
import { SearchResult } from './utils/search-helpers';

describe('AdvancedSearchService', () => {
  let service: AdvancedSearchService;
  let filtersService: Partial<SearchFiltersService>;
  let mlService: Partial<MLService>;
  let imgRecService: Partial<ImageRecognitionService>;

  const mockData: SearchResult[] = [
    { id: '1', title: 'A', popularity: 5, distance: 100, relevanceScore: 0.2 },
    { id: '2', title: 'B', popularity: 10, distance: 50, relevanceScore: 0.8 },
    { id: '3', title: 'C', popularity: 1, distance: 200, relevanceScore: 0.5 },
  ];

  beforeEach(async () => {
    filtersService = {
      applyFilters: jest.fn().mockResolvedValue(mockData),
      findByIds: jest.fn().mockResolvedValue(mockData.slice(0, 2)),
    };
    mlService = {
      rankByRelevance: jest.fn((data: SearchResult[]) =>
        [...data].sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0)),
      ),
    };
    imgRecService = {
      searchSimilar: jest.fn().mockResolvedValue(['1', '2']),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdvancedSearchService,
        { provide: SearchFiltersService, useValue: filtersService },
        { provide: MLService, useValue: mlService },
        { provide: ImageRecognitionService, useValue: imgRecService },
      ],
    }).compile();

    service = module.get<AdvancedSearchService>(AdvancedSearchService);
  });

  it('should sort by popularity', async () => {
    const results = await service.search({ filters: {}, sort: 'popularity' });
    expect(results.map(r => r.popularity)).toEqual([10, 5, 1]);
  });

  it('should sort by distance', async () => {
    const results = await service.search({ filters: {}, sort: 'distance' });
    expect(results.map(r => r.distance)).toEqual([50, 100, 200]);
  });

  it('should sort by relevance', async () => {
    const results = await service.search({ filters: {}, sort: 'relevance' });
    expect(mlService.rankByRelevance).toHaveBeenCalledWith(mockData);
    expect(results.map(r => r.id)).toEqual(['2', '3', '1']);
  });

  it('should perform image search and return matched items', async () => {
    const buffer = Buffer.from('dummy');
    const results = await service.imageSearch(buffer, 2);
    expect(imgRecService.searchSimilar).toHaveBeenCalledWith(buffer, 2);
    expect(filtersService.findByIds).toHaveBeenCalledWith(['1', '2']);
    expect(results.length).toBe(2);
    expect(results.map(r => r.id)).toEqual(['1', '2']);
  });
});
