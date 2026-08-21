/**
 * Minimal stand-in for the ioredis client used in tests. It deliberately has
 * no internal `await` before mutating state, so — exactly like real Redis —
 * concurrent callers racing on the same key can never both "win" the NX set,
 * even though the methods are declared `async`.
 */
export class FakeLockRedis {
    private readonly store = new Map<string, string>();
  
    async set(
      key: string,
      value: string,
      _mode: 'PX',
      _ttlMs: number,
      _flag: 'NX',
    ): Promise<'OK' | null> {
      if (this.store.has(key)) {
        return null;
      }
      this.store.set(key, value);
      return 'OK';
    }
  
    async eval(
      _script: string,
      _numKeys: number,
      key: string,
      token: string,
    ): Promise<number> {
      if (this.store.get(key) === token) {
        this.store.delete(key);
        return 1;
      }
      return 0;
    }
  }
  
  export class FakeCache {
    private readonly store = new Map<string, unknown>();
  
    async get<T>(key: string): Promise<T | undefined> {
      return this.store.get(key) as T | undefined;
    }
  
    async set(key: string, value: unknown): Promise<void> {
      this.store.set(key, value);
    }
  }