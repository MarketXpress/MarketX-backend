/**
 * K6 Load Testing Script for MarketX Backend
 * 
 * This script simulates 200 virtual users hitting heavy query endpoints
 * over a 5-minute peak duration to identify performance bottlenecks,
 * memory capacity limits, and latency dropoffs.
 * 
 * Run with: k6 run load-testing/k6/load-test.js
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';
import { randomItem, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Environment configuration
const TARGET_URL = __ENV.TARGET_URL || 'http://localhost:3000';
const API_VERSION = __ENV.API_VERSION || 'v1';

// Custom metrics
const errorRate = new Rate('errors');
const slowResponseRate = new Rate('slow_responses');
const productQueryDuration = new Trend('product_query_duration');
const orderQueryDuration = new Trend('order_query_duration');
const categoryQueryDuration = new Trend('category_query_duration');
const analyticsQueryDuration = new Trend('analytics_query_duration');
const memoryPressure = new Gauge('memory_pressure_indicator');
const heavyQueryCount = new Counter('heavy_query_count');

// Test configuration
export const options = {
  // Stages define the load pattern
  stages: [
    // Warm-up: Ramp up to 50 VUs over 1 minute
    { duration: '1m', target: 50 },
    
    // Peak load: 200 VUs for 5 minutes (main test phase)
    { duration: '5m', target: 200 },
    
    // Cool-down: Ramp down to 0 over 1 minute
    { duration: '1m', target: 0 },
  ],
  
  // Thresholds define pass/fail criteria
  thresholds: {
    // HTTP errors should be less than 5%
    'errors': ['rate<0.05'],
    
    // 95% of requests should complete within 2000ms
    'http_req_duration': ['p(95)<2000'],
    
    // 99% of requests should complete within 5000ms
    'http_req_duration': ['p(99)<5000'],
    
    // Average response time should be under 1000ms
    'http_req_duration': ['avg<1000'],
    
    // Slow responses (>3s) should be less than 10%
    'slow_responses': ['rate<0.10'],
    
    // HTTP request failure rate should be less than 5%
    'http_req_failed': ['rate<0.05'],
    
    // Specific query thresholds
    'product_query_duration': ['p(95)<2500', 'p(99)<5000'],
    'order_query_duration': ['p(95)<2000', 'p(99)<4000'],
    'category_query_duration': ['p(95)<1500', 'p(99)<3000'],
    'analytics_query_duration': ['p(95)<3000', 'p(99)<6000'],
  },
  
  // Additional options
  noConnectionReuse: false,
  userAgent: 'K6LoadTest/1.0',
  batch: 10,
  batchPerHost: 5,
  
  // Tags for all requests
  tags: {
    testType: 'load',
    environment: __ENV.ENVIRONMENT || 'staging',
  },
};

// Test data
const categories = ['cat-electronics-001', 'cat-fashion-002', 'cat-home-003', 'cat-sports-004'];
const sortOptions = ['price', 'createdAt', 'popularity'];
const priceRanges = [
  { min: 0, max: 50 },
  { min: 50, max: 200 },
  { min: 200, max: 1000 },
];

// Helper function to create headers
function getHeaders() {
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-Load-Test': 'true',
    'X-Test-Run-ID': `k6-${Date.now()}`,
  };
}

// Helper function to check response
function checkResponse(response, expectedStatus = 200, metricTrend = null) {
  const success = check(response, {
    [`status is ${expectedStatus}`]: (r) => r.status === expectedStatus,
    'response has body': (r) => r.body && r.body.length > 0,
    'response time < 3000ms': (r) => r.timings.duration < 3000,
  });
  
  errorRate.add(!success);
  slowResponseRate.add(response.timings.duration > 3000);
  
  if (metricTrend) {
    metricTrend.add(response.timings.duration);
  }
  
  // Simulate memory pressure detection based on response time
  if (response.timings.duration > 5000) {
    memoryPressure.add(1);
  } else if (response.timings.duration < 500) {
    memoryPressure.add(0);
  }
  
  return success;
}

/**
 * Scenario 1: Heavy Product Filtering and Search (40% weight)
 */
function productSearchAndFilter() {
  group('Product Search & Filter - Heavy Query', () => {
    const priceRange = randomItem(priceRanges);
    const category = randomItem(categories);
    const sortBy = randomItem(sortOptions);
    
    // Complex product query with multiple filters
    let response = http.get(
      `${TARGET_URL}/products?page=1&limit=20&minPrice=${priceRange.min}&maxPrice=${priceRange.max}&category=${category}&sortBy=${sortBy}&order=desc&inStock=true`,
      { headers: getHeaders(), tags: { name: 'ProductListFiltered' } }
    );
    
    checkResponse(response, 200, productQueryDuration);
    heavyQueryCount.add(1);
    
    // Extract product ID from response
    let productId = null;
    try {
      const data = JSON.parse(response.body);
      if (data.data && data.data.length > 0) {
        productId = data.data[0].id;
      }
    } catch (e) {
      // Use fallback ID
      productId = 'test-product-id';
    }
    
    sleep(0.5);
    
    // Get specific product details
    response = http.get(
      `${TARGET_URL}/products/${productId}`,
      { headers: getHeaders(), tags: { name: 'ProductDetails' } }
    );
    checkResponse(response, 200, productQueryDuration);
    
    sleep(0.5);
    
    // Get product price history (heavy query with historical data)
    response = http.get(
      `${TARGET_URL}/products/${productId}/price-history`,
      { headers: getHeaders(), tags: { name: 'ProductPriceHistory' } }
    );
    checkResponse(response, [200, 401], productQueryDuration);
    heavyQueryCount.add(1);
    
    sleep(0.5);
    
    // Search products with text query
    response = http.get(
      `${TARGET_URL}/products?search=laptop&page=1&limit=20&sortBy=price`,
      { headers: getHeaders(), tags: { name: 'ProductSearch' } }
    );
    checkResponse(response, 200, productQueryDuration);
    heavyQueryCount.add(1);
  });
}

/**
 * Scenario 2: Order Listing with Filters (30% weight)
 */
function orderQueriesWithFiltering() {
  group('Order Queries - Heavy Filtering', () => {
    // List all orders (potentially heavy query)
    let response = http.get(
      `${TARGET_URL}/orders`,
      { headers: getHeaders(), tags: { name: 'OrderList' } }
    );
    checkResponse(response, [200, 401], orderQueryDuration);
    heavyQueryCount.add(1);
    
    // Extract order ID
    let orderId = 'test-order-id';
    try {
      const data = JSON.parse(response.body);
      if (data.data && data.data.length > 0) {
        orderId = data.data[0].id;
      }
    } catch (e) {
      // Use fallback
    }
    
    sleep(0.5);
    
    // Get specific order details
    response = http.get(
      `${TARGET_URL}/orders/${orderId}`,
      { headers: getHeaders(), tags: { name: 'OrderDetails' } }
    );
    checkResponse(response, [200, 404, 401], orderQueryDuration);
    
    sleep(0.5);
    
    // List orders by buyer (filtered query)
    const buyerId = `buyer-${randomIntBetween(1, 100)}`;
    response = http.get(
      `${TARGET_URL}/orders?buyerId=${buyerId}`,
      { headers: getHeaders(), tags: { name: 'OrdersByBuyer' } }
    );
    checkResponse(response, [200, 401], orderQueryDuration);
    heavyQueryCount.add(1);
  });
}

/**
 * Scenario 3: Category Navigation with Nested Queries (15% weight)
 */
function categoryNavigationNested() {
  group('Category Navigation - Nested Queries', () => {
    // List all categories
    let response = http.get(
      `${TARGET_URL}/categories`,
      { headers: getHeaders(), tags: { name: 'CategoryList' } }
    );
    checkResponse(response, 200, categoryQueryDuration);
    
    // Extract category ID
    let categoryId = randomItem(categories);
    try {
      const data = JSON.parse(response.body);
      if (data.data && data.data.length > 0) {
        categoryId = data.data[0].id;
      }
    } catch (e) {
      // Use fallback
    }
    
    sleep(0.3);
    
    // Get category details
    response = http.get(
      `${TARGET_URL}/categories/${categoryId}`,
      { headers: getHeaders(), tags: { name: 'CategoryDetails' } }
    );
    checkResponse(response, [200, 404], categoryQueryDuration);
    
    sleep(0.3);
    
    // Get products in category with filters (heavy query)
    response = http.get(
      `${TARGET_URL}/products?category=${categoryId}&page=1&limit=50&sortBy=popularity`,
      { headers: getHeaders(), tags: { name: 'ProductsByCategory' } }
    );
    checkResponse(response, 200, categoryQueryDuration);
    heavyQueryCount.add(1);
  });
}

/**
 * Scenario 4: Analytics and Reporting Queries (10% weight)
 */
function analyticsHeavyAggregations() {
  group('Analytics Queries - Heavy Aggregations', () => {
    // Get analytics dashboard (heavy aggregation)
    let response = http.get(
      `${TARGET_URL}/analytics/dashboard`,
      { headers: getHeaders(), tags: { name: 'AnalyticsDashboard' } }
    );
    checkResponse(response, [200, 401], analyticsQueryDuration);
    heavyQueryCount.add(1);
    
    sleep(1);
    
    // Get user analytics
    const userId = `user-${randomIntBetween(1, 100)}`;
    response = http.get(
      `${TARGET_URL}/analytics/users/${userId}`,
      { headers: getHeaders(), tags: { name: 'UserAnalytics' } }
    );
    checkResponse(response, [200, 401, 404], analyticsQueryDuration);
    heavyQueryCount.add(1);
  });
}

/**
 * Scenario 5: Admin Operations and Reports (5% weight)
 */
function adminHeavyQueries() {
  group('Admin Heavy Queries', () => {
    // Get admin statistics (heavy aggregation)
    let response = http.get(
      `${TARGET_URL}/admin/stats`,
      { headers: getHeaders(), tags: { name: 'AdminStats' } }
    );
    checkResponse(response, [200, 401, 403]);
    heavyQueryCount.add(1);
    
    sleep(0.5);
    
    // Get pending escrows (complex join query)
    response = http.get(
      `${TARGET_URL}/admin/escrows/pending?page=1&limit=50`,
      { headers: getHeaders(), tags: { name: 'AdminEscrows' } }
    );
    checkResponse(response, [200, 401, 403]);
    heavyQueryCount.add(1);
    
    sleep(0.5);
    
    // Get audit logs (large dataset query)
    response = http.get(
      `${TARGET_URL}/audit/logs?page=1&limit=100&startDate=2026-01-01&endDate=2026-12-31`,
      { headers: getHeaders(), tags: { name: 'AuditLogs' } }
    );
    checkResponse(response, [200, 401, 403]);
    heavyQueryCount.add(1);
  });
}

/**
 * Main test function - Weighted scenario execution
 */
export default function () {
  const scenario = randomIntBetween(1, 100);
  
  // Weighted scenario selection based on acceptance criteria
  if (scenario <= 40) {
    // 40% - Heavy product filtering
    productSearchAndFilter();
  } else if (scenario <= 70) {
    // 30% - Order queries
    orderQueriesWithFiltering();
  } else if (scenario <= 85) {
    // 15% - Category navigation
    categoryNavigationNested();
  } else if (scenario <= 95) {
    // 10% - Analytics queries
    analyticsHeavyAggregations();
  } else {
    // 5% - Admin queries
    adminHeavyQueries();
  }
  
  // Random think time between iterations
  sleep(randomIntBetween(1, 3));
}

/**
 * Setup function - Runs once before the test
 */
export function setup() {
  console.log(`Starting load test against: ${TARGET_URL}`);
  console.log(`Test configuration: 200 VUs for 5 minutes`);
  console.log(`Weighted scenarios: Products(40%), Orders(30%), Categories(15%), Analytics(10%), Admin(5%)`);
  
  // Verify target is reachable
  const response = http.get(TARGET_URL);
  if (response.status !== 200 && response.status !== 404) {
    console.warn(`Warning: Target returned status ${response.status}`);
  }
  
  return { startTime: Date.now() };
}

/**
 * Teardown function - Runs once after the test
 */
export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(`Load test completed in ${duration.toFixed(2)} seconds`);
  console.log(`Check the generated report for detailed metrics and bottleneck analysis`);
}

/**
 * Handle summary - Custom summary output
 */
export function handleSummary(data) {
  return {
    'load-testing/reports/k6-summary.json': JSON.stringify(data, null, 2),
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
  };
}

// Helper for text summary
function textSummary(data, options) {
  const indent = options.indent || '';
  const enableColors = options.enableColors || false;
  
  let summary = '\n' + indent + '=== Load Test Summary ===\n\n';
  
  if (data.metrics) {
    summary += indent + 'Key Metrics:\n';
    
    if (data.metrics.http_req_duration) {
      const duration = data.metrics.http_req_duration;
      summary += indent + `  Response Time (avg): ${duration.values.avg.toFixed(2)}ms\n`;
      summary += indent + `  Response Time (p95): ${duration.values['p(95)'].toFixed(2)}ms\n`;
      summary += indent + `  Response Time (p99): ${duration.values['p(99)'].toFixed(2)}ms\n`;
    }
    
    if (data.metrics.http_reqs) {
      summary += indent + `  Total Requests: ${data.metrics.http_reqs.values.count}\n`;
      summary += indent + `  Request Rate: ${data.metrics.http_reqs.values.rate.toFixed(2)}/s\n`;
    }
    
    if (data.metrics.errors) {
      summary += indent + `  Error Rate: ${(data.metrics.errors.values.rate * 100).toFixed(2)}%\n`;
    }
    
    if (data.metrics.heavy_query_count) {
      summary += indent + `  Heavy Queries: ${data.metrics.heavy_query_count.values.count}\n`;
    }
  }
  
  summary += '\n' + indent + 'See detailed report in load-testing/reports/k6-summary.json\n';
  
  return summary;
}
