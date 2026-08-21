/* eslint-disable @typescript-eslint/no-explicit-any */
import { ConflictException } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { IdempotencyService } from '../common/idempotency/idempotency.service';
import { FakeCache, FakeLockRedis } from '../common/idempotency/testing/fake-lock-redis';

function buildController(ordersService: any, opts?: { cache?: FakeCache }) {
  const cache = opts?.cache ?? new FakeCache();
  const idempotencyService = new IdempotencyService(
    cache as any,
    new FakeLockRedis() as any,
  );
  const eventEmitter = { emit: jest.fn() };
  const ordersExportService = {} as any;

  const controller = new OrdersController(
    ordersService,
    ordersExportService,
    eventEmitter as any,
    idempotencyService,
    cache as any,
  );

  return { controller, cache, eventEmitter };
}

function makeOrdersService(delayMs = 0) {
  let calls = 0;
  return {
    create: jest.fn(async (dto: any) => {
      calls += 1;
      if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
      return {
        id: `order-${calls}`,
        buyerId: dto.buyerId,
        totalAmount: 100,
        items: [],
        currency: 'USD',
      };
    }),
  };
}

describe('OrdersController — Idempotency-Key concurrency', () => {
  const req = { user: { id: 'buyer-1' } };
  const dto = { items: [] } as any;

  it('creates the order exactly once when two identical requests are dispatched concurrently', async () => {
    const ordersService = makeOrdersService(10);
    const { controller } = buildController(ordersService);

    const results = await Promise.allSettled([
      controller.create(dto, req as any, 'same-key'),
      controller.create(dto, req as any, 'same-key'),
    ]);

    // The only unsafe outcome is two orders. A safe outcome is either the
    // second call getting the replayed response, or a 409 if it arrived
    // before the first had cached a response — both are acceptable, and
    // the controller's choice between them is intentionally out of scope
    // for this fix.
    expect(ordersService.create).toHaveBeenCalledTimes(1);

    for (const r of results) {
      if (r.status === 'rejected') {
        expect(r.reason).toBeInstanceOf(ConflictException);
      }
    }
  });

  it('replays the cached order for a second request once the first has completed', async () => {
    const ordersService = makeOrdersService(0);
    const { controller, eventEmitter } = buildController(ordersService);

    const first = await controller.create(dto, req as any, 'seq-key');
    const second = await controller.create(dto, req as any, 'seq-key');

    expect(first).toEqual(second);
    expect(ordersService.create).toHaveBeenCalledTimes(1);
    expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
  });

  it('returns 409 rather than creating a second order for a duplicate that arrives mid-flight', async () => {
    let releaseFirst: () => void;
    const gate = new Promise<void>((resolve) => (releaseFirst = resolve));

    const ordersService = {
      create: jest.fn(async (dto: any) => {
        await gate;
        return {
          id: 'order-in-flight',
          buyerId: dto.buyerId,
          totalAmount: 100,
          items: [],
          currency: 'USD',
        };
      }),
    };
    const { controller } = buildController(ordersService);

    const firstPromise = controller.create(dto, req as any, 'inflight-key');

    // Give the first request a tick to acquire the lock and start `create`.
    await new Promise((r) => setImmediate(r));

    await expect(
      controller.create(dto, req as any, 'inflight-key'),
    ).rejects.toBeInstanceOf(ConflictException);

    releaseFirst!();
    const first = await firstPromise;
    expect(first.id).toBe('order-in-flight');
    expect(ordersService.create).toHaveBeenCalledTimes(1);
  });
});