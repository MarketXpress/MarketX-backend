import { SetMetadata } from '@nestjs/common';
import { CACHE_CONTROL_KEY } from '../cache/guards/cache-control.guard';

export const CacheControl = (value: string) => SetMetadata(CACHE_CONTROL_KEY, value);

