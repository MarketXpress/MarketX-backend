import redis from '../store/redis.store';

type Input = { userId?: string; orderId?: string; metadata?: any };

export async function evaluateDuplicateOrder(input: Input) {
  if (!input.userId || !input.orderId) return { score: 0, reason: 'duplicate:insufficient' };

  const key = `fraud:duplicate:${input.userId}:${input.orderId}`;
  // Try to set the key only if not exists, with short TTL
  const setRes = await redis.set(key, '1', 'EX', 5 * 60, 'NX'); // 5 minutes
  if (setRes === null) {
    // key existed -> duplicate
    return { score: 40, reason: 'duplicate:repeat-order' };
  }

  return { score: 0, reason: 'duplicate:ok' };
}
