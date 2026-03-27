import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Listing } from '../listing/entities/listing.entity';
import { SearchService, ListingDocument } from './search.service';

@Injectable()
export class SearchSyncService implements OnModuleInit {
  private readonly logger = new Logger(SearchSyncService.name);

  constructor(
    @InjectRepository(Listing)
    private readonly listingRepository: Repository<Listing>,
    private readonly searchService: SearchService,
  ) {}

  async onModuleInit() {
    // Wait for the app to be fully initialized before syncing
    this.scheduleSync();
  }

  private async scheduleSync() {
    // Delay to allow database connections to be ready
    setTimeout(() => {
      this.syncListingsToSearch().catch((error) => {
        this.logger.error(`Failed to sync listings: ${error.message}`);
      });
    }, 5000);
  }

  async syncListingsToSearch(): Promise<{ synced: number; failed: number }> {
    if (!this.searchService.isInitialized()) {
      this.logger.warn('Search service not initialized. Skipping sync.');
      return { synced: 0, failed: 0 };
    }

    this.logger.log('Starting full listing sync to search index...');

    try {
      // Fetch all active listings that haven't expired
      const now = new Date();
      const listings = await this.listingRepository.find({
        where: {
          isActive: true,
          deletedAt: IsNull(),
        },
        relations: ['user'],
      });

      if (listings.length === 0) {
        this.logger.log('No listings to sync.');
        return { synced: 0, failed: 0 };
      }

      // Convert to search documents
      const documents: ListingDocument[] = listings.map((listing) => ({
        id: listing.id,
        title: listing.title,
        description: listing.description,
        price: Number(listing.price),
        currency: listing.currency,
        category: listing.category || '',
        location: listing.address || '',
        isActive: listing.isActive,
        quantity: listing.quantity,
        available: listing.available,
        views: listing.views || 0,
        isFeatured: listing.isFeatured,
        userId: listing.userId,
        createdAt: listing.createdAt?.getTime() || Date.now(),
        updatedAt: listing.updatedAt?.getTime() || Date.now(),
      }));

      // Bulk index
      await this.searchService.bulkIndex(documents);

      this.logger.log(`Successfully synced ${listings.length} listings to search index`);
      return { synced: listings.length, failed: 0 };
    } catch (error: any) {
      this.logger.error(`Listing sync failed: ${error.message}`);
      throw error;
    }
  }

  async syncSingleListing(listing: Listing, action: 'index' | 'update' | 'delete'): Promise<void> {
    if (!this.searchService.isInitialized()) {
      return;
    }

    const document: ListingDocument = {
      id: listing.id,
      title: listing.title,
      description: listing.description,
      price: Number(listing.price),
      currency: listing.currency,
      category: listing.category || '',
      location: listing.address || '',
      isActive: listing.isActive,
      quantity: listing.quantity,
      available: listing.available,
      views: listing.views || 0,
      isFeatured: listing.isFeatured,
      userId: listing.userId,
      createdAt: listing.createdAt?.getTime() || Date.now(),
      updatedAt: listing.updatedAt?.getTime() || Date.now(),
    };

    switch (action) {
      case 'index':
        await this.searchService.indexListing(document);
        break;
      case 'update':
        await this.searchService.updateListing(listing.id, document);
        break;
      case 'delete':
        await this.searchService.deleteListing(listing.id);
        break;
    }
  }
}
