export type CacheKey = string;
export type CacheValue = any;
export type CacheTags = string[];

export interface CacheStats {
  memoryUsage: number;
  keyCount: number;
  hitRate: number;
  missRate: number;
  evictionCount: number;
}

export interface CacheClusterConfig {
  nodes: Array<{
    host: string;
    port: number;
  }>;
  options: {
    enableReadyCheck: boolean;
    redisOptions: {
      password?: string;
    };
  };
}
