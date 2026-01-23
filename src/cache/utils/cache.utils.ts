export class CacheUtils {
  static generateUserCacheKey(userId: string, suffix: string): string {
    return `user:${userId}:${suffix}`;
  }

  static generateListingCacheKey(listingId: string, suffix?: string): string {
    return suffix ? `listing:${listingId}:${suffix}` : `listing:${listingId}`;
  }

  static generateMarketplaceCacheKey(marketplaceId: string, suffix?: string): string {
    return suffix ? `marketplace:${marketplaceId}:${suffix}` : `marketplace:${marketplaceId}`;
  }

  static generatePaginationKey(entity: string, page: number, limit: number, filters?: Record<string, any>): string {
    const filterString = filters ? `:${JSON.stringify(filters)}` : '';
    return `${entity}:page:${page}:limit:${limit}${filterString}`;
  }

  static extractUserIdFromKey(key: string): string | null {
    const match = key.match(/user:([^:]+):/);
    return match ? match[1] : null;
  }

  static extractEntityIdFromKey(key: string, entity: string): string | null {
    const pattern = new RegExp(`${entity}:([^:]+):`);
    const match = key.match(pattern);
    return match ? match[1] : null;
  }

  static isExpired(timestamp: number, ttl: number): boolean {
    return Date.now() - timestamp > ttl * 1000;
  }

  static calculateHitRate(hits: number, total: number): number {
    return total > 0 ? (hits / total) * 100 : 0;
  }

  static formatCacheSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }
}
