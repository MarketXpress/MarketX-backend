import { Injectable } from '@nestjs/common';
import { Cluster } from 'ioredis';
import { ICacheStrategy } from './cache-strategy.interface';
import { CacheClusterConfig } from '../types/cache.types';

@Injectable()
export class RedisClusterStrategy implements ICacheStrategy {
  private cluster: Cluster;

  constructor(config: CacheClusterConfig) {
    this.cluster = new Cluster(config.nodes, config.options);
  }

  async get<T>(key: string): Promise<T | null> {
    const data = await this.cluster.get(key);
    return data ? JSON.parse(data) : null;
  }

  async set<T>(key: string, value: T, ttl: number = 3600): Promise<void> {
    await this.cluster.setex(key, ttl, JSON.stringify(value));
  }

  async delete(key: string): Promise<void> {
    await this.cluster.del(key);
  }

  async clear(): Promise<void> {
    const nodes = this.cluster.nodes('master');
    await Promise.all(nodes.map(node => node.flushdb()));
  }

  async keys(pattern: string = '*'): Promise<string[]> {
    const nodes = this.cluster.nodes('master');
    const allKeys = await Promise.all(
      nodes.map(node => node.keys(pattern))
    );
    return allKeys.flat();
  }
}
