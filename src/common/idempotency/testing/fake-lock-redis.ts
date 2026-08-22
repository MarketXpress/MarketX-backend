/**
 * Minimal stand-in for the ioredis client used in tests. It deliberately has
 * no internal `await` before mutating state, so — exactly like real Redis —
 * concurrent callers racing on the same key can never both "win" the NX set,
 * even though the methods are declared to return a Promise.
 */
export class FakeLockRedis {
  private readonly store = new Map<string, string>();

  set(
    key: string,
    value: string,
    _mode: 'PX',
    _ttlMs: number,
    _flag: 'NX',
  ): Promise<'OK' | null> {
    if (this.store.has(key)) {
      return Promise.resolve(null);
    }
    this.store.set(key, value);
    return Promise.resolve('OK');
  }

  eval(
    _script: string,
    _numKeys: number,
    key: string,
    token: string,
  ): Promise<number> {
    if (this.store.get(key) === token) {
      this.store.delete(key);
      return Promise.resolve(1);
    }
    return Promise.resolve(0);
  }
}

export class FakeCache {
  private readonly store = new Map<string, unknown>();

  get<T>(key: string): Promise<T | undefined> {
    return Promise.resolve(this.store.get(key) as T | undefined);
  }

  set(key: string, value: unknown): Promise<void> {
    this.store.set(key, value);
    return Promise.resolve();
  }
}
