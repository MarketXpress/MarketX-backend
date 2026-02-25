/**
 * Centralised cache key builders.
 * Always use these — never hardcode cache key strings elsewhere.
 *
 * Convention: {domain}:{operation}:{stable-identifier}
 */
export const CacheKeys = {
  // Products
  productById:     (id: string)        => `products:id:${id}`,
  productSearch:   (hash: string)      => `products:search:${hash}`,
  productsBySeller:(sellerId: string)  => `products:seller:${sellerId}`,

  // Analytics
  sellerAnalytics: (sellerId: string)  => `analytics:seller:${sellerId}`,

  // Categories
  allCategories:   ()                  => `categories:all`,
  categoryById:    (id: string)        => `categories:id:${id}`,

  // Feature flags (short-lived)
  featureFlag:     (key: string)       => `feature_flag:${key}`,
} as const;

/** TTL values in seconds */
export const CacheTTL = {
  PRODUCT_SEARCH:   120,   // 2 min  – search results change often
  PRODUCT_DETAIL:   300,   // 5 min  – single product page
  PRODUCTS_SELLER:  180,   // 3 min  – seller's product list
  SELLER_ANALYTICS: 600,   // 10 min – heavy aggregation
  CATEGORIES:       3600,  // 1 hr   – rarely changes
  FEATURE_FLAG:     60,    // 1 min  – toggled by admin, should propagate fast
} as const;