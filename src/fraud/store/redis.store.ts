import Redis from 'ioredis';

let client: any;

if (process.env.NODE_ENV === 'test') {
  const store = new Map<string, any>();
  const sets = new Map<string, Set<string>>();

  client = {
    async incr(key: string) {
      const v = Number(store.get(key) || 0) + 1;
      store.set(key, v);
      return v;
    },
    async expire(_key: string, _sec: number) {
      return 1;
    },
    async set(key: string, value: string, _ex?: string, _ttl?: number, _nx?: string) {
      const exists = store.has(key);
      if (_nx === 'NX' && exists) return null;
      store.set(key, value);
      return 'OK';
    },
    async sismember(key: string, member: string) {
      const s = sets.get(key);
      return s && s.has(member) ? 1 : 0;
    },
    async sadd(key: string, member: string) {
      let s = sets.get(key);
      if (!s) {
        s = new Set<string>();
        sets.set(key, s);
      }
      const before = s.size;
      s.add(member);
      return s.size === before ? 0 : 1;
    },
    async scard(key: string) {
      const s = sets.get(key);
      return s ? s.size : 0;
    },
  } as any;
} else {
  const url = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
  client = new Redis(url);
  client.on('error', (err) => {
    process.stderr.write(`[redis] ${err.message}\n`);
  });
}

export default client;
