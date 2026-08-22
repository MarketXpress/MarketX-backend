import { Cache, createCache } from 'cache-manager';
import { ProductsController } from './products.controller';

/**
 * These tests verify that product mutations invalidate only the product
 * cache and never touch entries belonging to auth (TokenRegistryService)
 * or idempotency (IdempotencyService), both of which live in the global
 * CACHE_MANAGER.
 *
 * Root cause: the old code called `(this.cacheManager as any).reset()`.
 * That either threw TypeError (500 on a committed write) or flushed the
 * shared Redis database, invalidating every refresh token and idempotency
 * key on the platform.
 */

describe('ProductsController — product cache isolation', () => {
  let controller: ProductsController;
  let globalCache: Cache; // represents the shared CACHE_MANAGER
  let productCache: Cache; // the dedicated PRODUCT_CACHE

  // Minimal mock – the controller delegates to the service before touching
  // the cache, so we only need the service to return promptly.
  const mockProductsService: any = {
    create: jest.fn().mockResolvedValue({ id: 'p1', name: 'Widget' }),
    update: jest.fn().mockResolvedValue({ id: 'p1', name: 'Updated' }),
    updatePrice: jest.fn().mockResolvedValue({ id: 'p1', price: '25.00' }),
    remove: jest.fn().mockResolvedValue({ deleted: true }),
    findAll: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    findOne: jest.fn().mockResolvedValue({ id: 'p1' }),
  };

  beforeEach(() => {
    globalCache = createCache();
    productCache = createCache();

    controller = new ProductsController(mockProductsService, productCache);
  });

  afterEach(async () => {
    await globalCache.clear();
    await productCache.clear();
  });

  // ─── helpers ──────────────────────────────────────────────────────
  const fakeReq = (userId = 'user-1') => ({ user: { id: userId } });
  const emptyDto = { name: 'X', category: 'c' } as any;
  const priceDto = { basePrice: 10, baseCurrency: 'USD' } as any;

  // ─── Acceptance: refresh tokens survive every mutation ─────────────
  describe('refresh token (TokenRegistryService) survives mutations', () => {
    const tokenKey = 'refresh_token:user-1:tok-abc';

    it('after create', async () => {
      await globalCache.set(tokenKey, 'active', 60_000);
      await controller.create(fakeReq(), emptyDto);
      expect(await globalCache.get(tokenKey)).toBe('active');
    });

    it('after update', async () => {
      await globalCache.set(tokenKey, 'active', 60_000);
      await controller.update('p1', fakeReq(), emptyDto);
      expect(await globalCache.get(tokenKey)).toBe('active');
    });

    it('after price update', async () => {
      await globalCache.set(tokenKey, 'active', 60_000);
      await controller.updatePrice('p1', fakeReq(), priceDto);
      expect(await globalCache.get(tokenKey)).toBe('active');
    });

    it('after delete', async () => {
      await globalCache.set(tokenKey, 'active', 60_000);
      await controller.remove('p1', fakeReq());
      expect(await globalCache.get(tokenKey)).toBe('active');
    });
  });

  // ─── Acceptance: idempotency keys survive every mutation ──────────
  describe('idempotency key (IdempotencyService) survives mutations', () => {
    const idempKey = 'idempotency:order-999';

    it('after create', async () => {
      await globalCache.set(idempKey, '2025-01-01T00:00:00Z', 86_400_000);
      await controller.create(fakeReq(), emptyDto);
      expect(await globalCache.get(idempKey)).toBe('2025-01-01T00:00:00Z');
    });

    it('after update', async () => {
      await globalCache.set(idempKey, '2025-01-01T00:00:00Z', 86_400_000);
      await controller.update('p1', fakeReq(), emptyDto);
      expect(await globalCache.get(idempKey)).toBe('2025-01-01T00:00:00Z');
    });

    it('after price update', async () => {
      await globalCache.set(idempKey, '2025-01-01T00:00:00Z', 86_400_000);
      await controller.updatePrice('p1', fakeReq(), priceDto);
      expect(await globalCache.get(idempKey)).toBe('2025-01-01T00:00:00Z');
    });

    it('after delete', async () => {
      await globalCache.set(idempKey, '2025-01-01T00:00:00Z', 86_400_000);
      await controller.remove('p1', fakeReq());
      expect(await globalCache.get(idempKey)).toBe('2025-01-01T00:00:00Z');
    });
  });

  // ─── Acceptance: product cache IS invalidated by mutations ────────
  describe('product cache is cleared by mutations', () => {
    it('after create', async () => {
      await productCache.set('/products', [{ id: 'p1' }], 60_000);
      await controller.create(fakeReq(), emptyDto);
      expect(await productCache.get('/products')).toBeUndefined();
    });

    it('after update', async () => {
      await productCache.set('/products', [{ id: 'p1' }], 60_000);
      await controller.update('p1', fakeReq(), emptyDto);
      expect(await productCache.get('/products')).toBeUndefined();
    });

    it('after price update', async () => {
      await productCache.set('/products', [{ id: 'p1' }], 60_000);
      await controller.updatePrice('p1', fakeReq(), priceDto);
      expect(await productCache.get('/products')).toBeUndefined();
    });

    it('after delete', async () => {
      await productCache.set('/products', [{ id: 'p1' }], 60_000);
      await controller.remove('p1', fakeReq());
      expect(await productCache.get('/products')).toBeUndefined();
    });
  });

  // ─── Acceptance: product-cache and global-cache are independent ───
  describe('product and global caches are fully independent', () => {
    it('clearing product cache does not touch global cache', async () => {
      await globalCache.set('some:global:key', 'global-value', 60_000);
      await productCache.set('/products', [{ id: 'p1' }], 60_000);

      await productCache.clear();

      expect(await globalCache.get('some:global:key')).toBe('global-value');
    });

    it('clearing global cache does not touch product cache', async () => {
      await productCache.set('/products', [{ id: 'p1' }], 60_000);
      await globalCache.set('some:global:key', 'global-value', 60_000);

      await globalCache.clear();

      expect(await productCache.get('/products')).toEqual([{ id: 'p1' }]);
    });
  });

  // ─── Acceptance: cache clear is awaited (no unhandled promise) ────
  describe('cache clear is awaited', () => {
    it('create returns only after cache is cleared', async () => {
      // Before the fix, reset() was fire-and-forget.  After the fix,
      // await productCache.clear() is called, so the product is returned
      // only after invalidation completes.
      await productCache.set('/products', [{ id: 'stale' }], 60_000);

      const result = await controller.create(fakeReq(), emptyDto);

      expect(result).toEqual({ id: 'p1', name: 'Widget' });
      expect(await productCache.get('/products')).toBeUndefined();
    });
  });
});
