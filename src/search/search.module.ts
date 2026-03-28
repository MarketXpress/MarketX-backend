import { Module, Global } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchSyncService } from './search-sync.service';

@Global()
@Module({
  providers: [SearchService, SearchSyncService],
  exports: [SearchService, SearchSyncService],
})
export class SearchModule {}
