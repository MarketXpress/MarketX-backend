import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import TypeSense from 'typesense';

export interface ListingDocument {
  id: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  category: string;
  location: string;
  isActive: boolean;
  quantity: number;
  available: number;
  views: number;
  isFeatured: boolean;
  userId: string;
  createdAt: number;
  updatedAt: number;
}

@Injectable()
export class SearchService implements OnModuleInit {
  private client: TypeSense.Client;
  private readonly logger = new Logger(SearchService.name);
  private readonly collectionName = 'listings';

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const typesenseHost = this.configService.get<string>('TYPESENSE_HOST');
    const typesensePort = this.configService.get<number>('TYPESENSE_PORT');
    const typesenseProtocol =
      this.configService.get<string>('TYPESENSE_PROTOCOL') || 'http';
    const typesenseApiKey = this.configService.get<string>('TYPESENSE_API_KEY');

    if (!typesenseHost) {
      this.logger.warn(
        'Typesense host not configured. Search functionality will be disabled.',
      );
      return;
    }

    this.client = new TypeSense.Client({
      nodes: [
        {
          host: typesenseHost,
          port: typesensePort || 8108,
          protocol: typesenseProtocol,
        },
      ],
      apiKey: typesenseApiKey || 'xyz',
      connectionTimeoutSeconds: 2,
    });

    await this.initializeCollection();
  }

  private async initializeCollection() {
    try {
      // Check if collection exists
      await this.client.collections(this.collectionName).retrieve();
      this.logger.log(
        `Typesense collection '${this.collectionName}' already exists`,
      );
    } catch (error: any) {
      // Collection doesn't exist, create it
      if (error.status === 404) {
        try {
          await this.client.collections.create({
            name: this.collectionName,
            fields: [
              { name: 'id', type: 'string' },
              { name: 'title', type: 'string', facet: false },
              { name: 'description', type: 'string', facet: false },
              { name: 'price', type: 'float', facet: true },
              { name: 'currency', type: 'string', facet: true },
              { name: 'category', type: 'string', facet: true },
              { name: 'location', type: 'string', facet: true },
              { name: 'isActive', type: 'bool', facet: true },
              { name: 'quantity', type: 'int64', facet: true },
              { name: 'available', type: 'int64', facet: true },
              { name: 'views', type: 'int64', facet: true },
              { name: 'isFeatured', type: 'bool', facet: true },
              { name: 'userId', type: 'string', facet: true },
              { name: 'createdAt', type: 'int64', facet: false },
              { name: 'updatedAt', type: 'int64', facet: false },
            ],
            token_separators: ['&', '-', '.', ' ', '_'],
            enable_default_fallback: true,
          });
          this.logger.log(
            `Created Typesense collection '${this.collectionName}'`,
          );
        } catch (createError: any) {
          this.logger.error(
            `Failed to create Typesense collection: ${createError.message}`,
          );
        }
      } else {
        this.logger.error(`Failed to initialize Typesense: ${error.message}`);
      }
    }
  }

  async indexListing(listing: ListingDocument): Promise<void> {
    if (!this.client) {
      this.logger.warn('Typesense not initialized. Skipping indexing.');
      return;
    }

    try {
      await this.client
        .collections(this.collectionName)
        .documents.upsert(listing);
      this.logger.debug(`Indexed listing: ${listing.id}`);
    } catch (error: any) {
      this.logger.error(
        `Failed to index listing ${listing.id}: ${error.message}`,
      );
    }
  }

  async updateListing(
    id: string,
    updates: Partial<ListingDocument>,
  ): Promise<void> {
    if (!this.client) {
      this.logger.warn('Typesense not initialized. Skipping update.');
      return;
    }

    try {
      await this.client
        .collections(this.collectionName)
        .documents(id)
        .update(updates);
      this.logger.debug(`Updated listing in index: ${id}`);
    } catch (error: any) {
      this.logger.error(`Failed to update listing ${id}: ${error.message}`);
    }
  }

  async deleteListing(id: string): Promise<void> {
    if (!this.client) {
      this.logger.warn('Typesense not initialized. Skipping deletion.');
      return;
    }

    try {
      await this.client.collections(this.collectionName).documents(id).delete();
      this.logger.debug(`Deleted listing from index: ${id}`);
    } catch (error: any) {
      this.logger.error(`Failed to delete listing ${id}: ${error.message}`);
    }
  }

  async search(
    query: string,
    options: {
      limit?: number;
      offset?: number;
      category?: string;
      minPrice?: number;
      maxPrice?: number;
      location?: string;
    } = {},
  ): Promise<{ results: ListingDocument[]; total: number }> {
    if (!this.client) {
      this.logger.warn('Typesense not initialized. Returning empty results.');
      return { results: [], total: 0 };
    }

    const {
      limit = 20,
      offset = 0,
      category,
      minPrice,
      maxPrice,
      location,
    } = options;

    const filterConditions: string[] = [];
    if (category) {
      filterConditions.push(`category:=${category}`);
    }
    if (minPrice !== undefined) {
      filterConditions.push(`price>=${minPrice}`);
    }
    if (maxPrice !== undefined) {
      filterConditions.push(`price<=${maxPrice}`);
    }
    if (location) {
      filterConditions.push(`location:="${location}"`);
    }
    filterConditions.push('isActive:=true');

    try {
      const searchResult = await this.client
        .collections(this.collectionName)
        .documents()
        .search({
          q: query,
          query_by: 'title,description,category',
          filter_by: filterConditions.join(' && '),
          per_page: limit,
          page: Math.floor(offset / limit) + 1,
          sort_by: 'views:desc,createdAt:desc',
          prefix: true,
          num_typos: 2,
        });

      const results = (searchResult.hits || []).map((hit: any) => ({
        ...hit.document,
        createdAt: hit.document.createdAt,
        updatedAt: hit.document.updatedAt,
      }));

      return {
        results,
        total: searchResult.found || 0,
      };
    } catch (error: any) {
      this.logger.error(`Search failed: ${error.message}`);
      return { results: [], total: 0 };
    }
  }

  async bulkIndex(listings: ListingDocument[]): Promise<void> {
    if (!this.client || listings.length === 0) {
      return;
    }

    try {
      const importResults = await this.client
        .collections(this.collectionName)
        .documents()
        .import(listings, { action: 'upsert' });

      const failed = importResults.filter((r: any) => !r.success);
      if (failed.length > 0) {
        this.logger.warn(`Failed to import ${failed.length} listings`);
      } else {
        this.logger.log(`Successfully indexed ${listings.length} listings`);
      }
    } catch (error: any) {
      this.logger.error(`Bulk indexing failed: ${error.message}`);
    }
  }

  isInitialized(): boolean {
    return !!this.client;
  }
}
