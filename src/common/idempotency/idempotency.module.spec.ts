import { CacheModule } from '@nestjs/cache-manager';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { IdempotencyModule } from './idempotency.module';
import { IdempotencyService } from './idempotency.service';

describe('IdempotencyModule', () => {
  it('exports the idempotency service and cache provider for importing modules', () => {
    const exports =
      Reflect.getMetadata(MODULE_METADATA.EXPORTS, IdempotencyModule) ?? [];

    expect(exports).toEqual(
      expect.arrayContaining([IdempotencyService, CacheModule]),
    );
  });
});
