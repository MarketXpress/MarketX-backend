/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import redis from '../store/redis.store';

type Input = { userId?: string; metadata?: any };

export async function evaluateVelocity(input: Input) {
  const user = input.userId || 'anon';
  if (!input.userId) return { score: 0, reason: 'velocity:insufficient' };
  const windowSec = 60; // 1 minute window
  const threshold = 20; // suspicious if >20 reqs/min

  const key = `fraud:velocity:${user}`;
  const count = await redis.incr(key);
  // ensure TTL roughly equals window
  await redis.expire(key, windowSec);

  if (count > threshold) {
    const score = Math.min(50, (count - threshold) * 2); // scale moderately
    return { score, reason: `velocity:${count}/min` };
  }

  return { score: 0, reason: 'velocity:ok' };
}
