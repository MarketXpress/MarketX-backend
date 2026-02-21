import redis from '../store/redis.store';

type Input = { ip?: string; deviceFingerprint?: string };

export async function evaluateIpFingerprint(input: Input) {
  let score = 0;
  const reasons: string[] = [];

  if (input.ip) {
    const isBlack = await redis.sismember('fraud:blacklist:ips', input.ip);
    if (isBlack) {
      score += 40;
      reasons.push('ip:blacklist');
    }
  }

  if (input.deviceFingerprint) {
    const key = `fraud:fp:${input.deviceFingerprint}`;
    const wasMember = input.ip ? await redis.sismember(key, input.ip) : 0;
    // add ip to fingerprint set and set TTL
    if (input.ip) await redis.sadd(key, input.ip);
    await redis.expire(key, 24 * 3600); // keep 24h history

    const count = await redis.scard(key);
    if (input.ip && !wasMember && count >= 3) {
      score += 30;
      reasons.push('fingerprint:multi-ip');
    }
  }

  return { score, reason: reasons.join('|') || 'ipfp:ok' };
}
