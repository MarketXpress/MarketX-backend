export const cacheConfig = {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB) || 0,
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'marketx:',
    retryDelayOnFailover: 100,
    enableReadyCheck: false,
    maxRetriesPerRequest: 3,
  },
  memory: {
    maxItems: parseInt(process.env.CACHE_MAX_MEMORY_ITEMS) || 1000,
    checkPeriod: 60000,
  },
  ttl: {
    default: 3600, 
    short: 300,    
    medium: 1800,  
    long: 7200,    
    daily: 86400,  
};
