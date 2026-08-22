import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cache } from 'cache-manager';
import Redis from 'ioredis';
import { randomUUID } from 'crypto';

export const IDEMPOTENCY_LOCK_CLIENT = Symbol('IDEMPOTENCY_LOCK_CLIENT');

// Only delete the lock if it still holds the token *we* set. Without this,
// a caller whose operation outran the TTL could delete a lock some other
// caller legitimately acquired after ours expired.
const RELEASE_IF_OWNER_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;

@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);

  // How long an in-flight claim is honored before it's considered abandoned.
  // Order creation here is one DB insert plus an in-process event emit, so
  // it should finish well under a second normally. 30s gives generous
  // headroom for GC pauses / DB latency spikes without leaving a *crashed*
  // instance blocking the key for long. Successful and failed runs release
  // the lock explicitly in `finally`, so this TTL is only ever exercised
  // by the crash case, not the happy path.
  private readonly lockTtlMs = parseInt(
    process.env.IDEMPOTENCY_LOCK_TTL_MS || '30000',
    10,
  );

  constructor(
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    @Inject(IDEMPOTENCY_LOCK_CLIENT) private readonly lockClient: Redis,
  ) {}

  async executeOnce<T>(
    key: string,
    operation: () => Promise<T>,
    ttlSeconds = 24 * 60 * 60,
  ): Promise<{ executed: boolean; result?: T }> {
    const cacheKey = this.toCacheKey(key);
    const doneKey = `${cacheKey}:done`;
    const lockKey = `${cacheKey}:lock`;
    const token = randomUUID();

    // Fast-path only. This never claims anything, so there is nothing for a
    // second caller to race against here — it just avoids taking a lock for
    // a key we already know is finished.
    const alreadyProcessed = await this.cache.get<string>(doneKey);
    if (alreadyProcessed) {
      return { executed: false };
    }

    // Atomic claim: SET key val NX PX ttl is a single Redis command. Two
    // callers racing on the same key can never both get back 'OK' — this is
    // what actually prevents the duplicate, whether the two callers are two
    // requests on one instance or two requests on two different instances
    // sharing the same Redis. There is no await between "check" and "claim"
    // because there is no separate check: the claim attempt *is* the check.
    const acquired = await this.lockClient.set(
      lockKey,
      token,
      'PX',
      this.lockTtlMs,
      'NX',
    );

    if (acquired !== 'OK') {
      return { executed: false };
    }

    try {
      const result = await operation();
      // Written only on success, so a failed operation leaves no trace here
      // and the key remains retryable.
      await this.cache.set(
        doneKey,
        new Date().toISOString(),
        ttlSeconds * 1000,
      );
      return { executed: true, result };
    } catch (error) {
      this.logger.warn(`Idempotent operation failed for key ${cacheKey}`);
      throw error;
    } finally {
      // Release promptly rather than waiting out the TTL, so a failed
      // operation is immediately retryable instead of blocked for 30s.
      await this.lockClient.eval(RELEASE_IF_OWNER_SCRIPT, 1, lockKey, token);
    }
  }

  private toCacheKey(key: string): string {
    return `idempotency:${key}`;
  }
}
