import { IdempotencyService } from './idempotency.service';
import { FakeCache, FakeLockRedis } from './testing/fake-lock-redis';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('IdempotencyService', () => {
  let cache: FakeCache;
  let lockClient: FakeLockRedis;
  let service: IdempotencyService;

  beforeEach(() => {
    cache = new FakeCache();
    lockClient = new FakeLockRedis();
    service = new IdempotencyService(cache as any, lockClient as any);
  });

  it('runs the operation exactly once when two calls race on the same key', async () => {
    const operation = jest.fn(async () => {
      await delay(10); // force real overlap between the two calls
      return 'ok';
    });

    const [first, second] = await Promise.all([
      service.executeOnce('order:123', operation),
      service.executeOnce('order:123', operation),
    ]);

    expect(operation).toHaveBeenCalledTimes(1);
    const executedCount = [first, second].filter((r) => r.executed).length;
    expect(executedCount).toBe(1);
  });

  it('does not mark the key processed when the operation fails, so it stays retryable', async () => {
    const operation = jest
      .fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce('recovered');

    await expect(service.executeOnce('job:1', operation)).rejects.toThrow(
      'fail',
    );

    const second = await service.executeOnce('job:1', operation);

    expect(second.executed).toBe(true);
    expect(second.result).toBe('recovered');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('does not allow a successful operation to be replayed into a second execution', async () => {
    const operation = jest.fn(() => Promise.resolve('ok'));

    const first = await service.executeOnce('order:456', operation);
    const second = await service.executeOnce('order:456', operation);

    expect(first.executed).toBe(true);
    expect(second.executed).toBe(false);
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('prevents duplicate execution across two independent service instances sharing the same lock/cache backend', async () => {
    // Simulates two Node processes behind a load balancer: separate
    // IdempotencyService instances, same underlying Redis/cache.
    const instanceA = new IdempotencyService(cache as any, lockClient as any);
    const instanceB = new IdempotencyService(cache as any, lockClient as any);

    const operation = jest.fn(async () => {
      await delay(10);
      return 'ok';
    });

    const [resultA, resultB] = await Promise.all([
      instanceA.executeOnce('order:cross-instance', operation),
      instanceB.executeOnce('order:cross-instance', operation),
    ]);

    expect(operation).toHaveBeenCalledTimes(1);
    const executedCount = [resultA, resultB].filter((r) => r.executed).length;
    expect(executedCount).toBe(1);
  });

  it('releases the lock immediately on failure instead of waiting out the TTL', async () => {
    const operation = jest
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce('ok');

    await expect(
      service.executeOnce('job:retry-fast', operation),
    ).rejects.toThrow('boom');

    // If the lock weren't released promptly, this would come back
    // executed: false instead of running the operation again.
    const retried = await service.executeOnce('job:retry-fast', operation);
    expect(retried.executed).toBe(true);
    expect(retried.result).toBe('ok');
  });
});
