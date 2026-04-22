import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Listing } from '../listing/entities/listing.entity';
import { SearchService } from './search.service';
import { SearchSyncService } from './search-sync.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Listing])],
  providers: [SearchService, SearchSyncService],
  exports: [SearchService, SearchSyncService],
})
export class SearchModule {}
