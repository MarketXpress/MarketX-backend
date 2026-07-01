import { MODULE_METADATA } from '@nestjs/common/constants';
import { IdempotencyModule } from '../common/idempotency/idempotency.module';
import { OrdersModule } from './orders.module';

describe('OrdersModule', () => {
  it('imports IdempotencyModule for order creation idempotency dependencies', () => {
    const imports =
      Reflect.getMetadata(MODULE_METADATA.IMPORTS, OrdersModule) ?? [];

    expect(imports).toContain(IdempotencyModule);
  });
});
