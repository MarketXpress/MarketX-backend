import { IdempotencyService } from './idempotency.service';

describe('IdempotencyService', () => {
  const cache = {
    store: new Map<string, any>(),
    get: jest.fn(async function (this: any, key: string) {
      return this.store.get(key);
    }),
    set: jest.fn(async function (this: any, key: string, value: any) {
      this.store.set(key, value);
    }),
  };

  let service: IdempotencyService;

  beforeEach(() => {
    cache.store.clear();
    jest.clearAllMocks();
    service = new IdempotencyService(cache as any);
  });

  it('executes operation only once per key', async () => {
    const operation = jest.fn(async () => 'ok');

    const first = await service.executeOnce('order:123', operation);
    const second = await service.executeOnce('order:123', operation);

    expect(first.executed).toBe(true);
    expect(second.executed).toBe(false);
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('does not mark key as processed when operation fails', async () => {
    const operation = jest
      .fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce('recovered');

    await expect(service.executeOnce('job:1', operation)).rejects.toThrow('fail');
    const second = await service.executeOnce('job:1', operation);

    expect(second.executed).toBe(true);
    expect(operation).toHaveBeenCalledTimes(2);
  });
});
