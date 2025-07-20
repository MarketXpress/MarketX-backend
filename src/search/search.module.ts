import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Listing } from '../listings/listing.entity';
import { SearchController } from './search.controller';
import { AdvancedSearchService } from './advanced-search.service';
import { SearchFiltersService } from './search-filters.service';
import { SavedSearchesService } from './saved-searches.service';
import { MLService } from '../ai/ml.service';
import { ImageRecognitionService } from '../ai/image-recognition.service';

@Module({
  imports: [TypeOrmModule.forFeature([Listing])],
  controllers: [SearchController],
  providers: [
    AdvancedSearchService,
    SearchFiltersService,
    SavedSearchesService,
    MLService,
    ImageRecognitionService,
  ],
})
export class SearchModule {}
