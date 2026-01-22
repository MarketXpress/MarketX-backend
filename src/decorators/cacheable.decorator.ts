import { SetMetadata } from '@nestjs/common';
import { CacheConfig } from '../cache/interfaces/cache.interface';

export const CACHEABLE_KEY = 'cacheable';

export const Cacheable = (config: CacheConfig) => SetMetadata(CACHEABLE_KEY, config);
