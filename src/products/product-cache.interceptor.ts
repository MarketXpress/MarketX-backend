import { Inject, Injectable } from '@nestjs/common';
import { CacheInterceptor } from '@nestjs/cache-manager';
import { Reflector } from '@nestjs/core';
import { Cache } from 'cache-manager';

export const PRODUCT_CACHE = 'PRODUCT_CACHE';

/**
 * Interceptor that caches GET responses in a product-dedicated cache
 * instance.  Mutations call `clear()` on this same instance, so only
 * product entries are evicted — auth tokens and idempotency keys stored
 * in the global CACHE_MANAGER are never touched.
 */
@Injectable()
export class ProductCacheInterceptor extends CacheInterceptor {
  constructor(
    @Inject(PRODUCT_CACHE) productCache: Cache,
    reflector: Reflector,
  ) {
    super(productCache, reflector);
  }
}
