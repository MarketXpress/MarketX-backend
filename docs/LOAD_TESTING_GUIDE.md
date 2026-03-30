# Load Testing Guide - MarketX Backend

## Overview

This guide provides comprehensive documentation for the distributed load testing workflows implemented for the MarketX Backend API. The load testing infrastructure is designed to identify concurrent threshold capabilities, visualize performance bottlenecks, and provide quantitative evidence for optimization decisions.

## Table of Contents

1. [Introduction](#introduction)
2. [Test Architecture](#test-architecture)
3. [Test Scenarios](#test-scenarios)
4. [Installation & Setup](#installation--setup)
5. [Running Tests](#running-tests)
6. [Interpreting Results](#interpreting-results)
7. [Performance Optimization](#performance-optimization)
8. [CI/CD Integration](#cicd-integration)
9. [Troubleshooting](#troubleshooting)

## Introduction

### Purpose

The load testing suite addresses the following objectives:

- **Identify Concurrent Thresholds**: Determine the exact number of concurrent users the system can handle
- **Quantify Performance**: Measure response times, throughput, and error rates under load
- **Detect Bottlenecks**: Identify database queries, API endpoints, or system resources causing performance degradation
- **Memory Analysis**: Monitor memory usage patterns and identify potential memory leaks
- **Drive Optimization**: Provide hard evidence to support indexing, caching, and scaling decisions

### Tools Used

1. **Artillery**: HTTP load testing toolkit with YAML configuration
   - Pros: Easy to configure, great for scenario-based testing
   - Use case: Quick load tests, CI/CD integration

2. **K6**: Modern load testing tool with JavaScript scripting
   - Pros: Powerful scripting, detailed metrics, excellent for complex scenarios
   - Use case: Detailed performance analysis, custom metrics

## Test Architecture

### Load Pattern

The tests follow a three-phase approach:

```
Phase 1: Warm-up (1 minute)
├─ Gradually ramp from 0 to 50 virtual users
└─ Purpose: Allow system to initialize caches and connections

Phase 2: Peak Load (5 minutes)
├─ Maintain 200 concurrent virtual users
└─ Purpose: Stress test at target capacity

Phase 3: Cool-down (1 minute)
├─ Gradually ramp down from 50 to 0 users
└─ Purpose: Observe system recovery behavior
```

### Weighted Scenarios

Traffic is distributed across realistic user scenarios:

| Scenario | Weight | Description | Key Endpoints |
|----------|--------|-------------|---------------|
| Product Search & Filter | 40% | Heavy queries with filters, sorting, pagination | `/products`, `/products/:id/price-history` |
| Order Queries | 30% | Order listing with buyer filters | `/orders`, `/orders?buyerId=X` |
| Category Navigation | 15% | Nested category queries | `/categories`, `/products?category=X` |
| Analytics Queries | 10% | Dashboard aggregations | `/analytics/dashboard` |
| Admin Operations | 5% | Heavy admin queries | `/admin/stats`, `/audit/logs` |

## Test Scenarios

### Scenario 1: Product Search & Filter (40%)

**Purpose**: Test the most common user flow - browsing and searching products

**Endpoints Tested**:
- `GET /products?page=1&limit=20&minPrice=10&maxPrice=500&category=X&sortBy=price&order=desc&inStock=true`
- `GET /products/:id`
- `GET /products/:id/price-history`
- `GET /products?search=laptop&page=1&limit=20&sortBy=price`

**Expected Bottlenecks**:
- Database query performance with multiple filters
- Index utilization on price, category, and stock fields
- Price history aggregation queries

**Optimization Targets**:
- Add composite indexes on frequently filtered columns
- Implement Redis caching for popular products
- Optimize price history query with proper date indexing

### Scenario 2: Order Queries (30%)

**Purpose**: Test order management and buyer-specific queries

**Endpoints Tested**:
- `GET /orders`
- `GET /orders/:id`
- `GET /orders?buyerId=X`

**Expected Bottlenecks**:
- Order listing without pagination limits
- Buyer-specific filtering without proper indexing
- Join operations with order items

**Optimization Targets**:
- Add index on `buyerId` column
- Implement pagination limits
- Optimize order item joins

### Scenario 3: Category Navigation (15%)

**Purpose**: Test category browsing and product discovery

**Endpoints Tested**:
- `GET /categories`
- `GET /categories/:id`
- `GET /products?category=X&page=1&limit=50&sortBy=popularity`

**Expected Bottlenecks**:
- Nested category queries
- Product count aggregations per category
- Popularity sorting calculations

**Optimization Targets**:
- Cache category tree structure
- Pre-calculate product counts
- Add index on category and popularity fields

### Scenario 4: Analytics Queries (10%)

**Purpose**: Test reporting and analytics endpoints

**Endpoints Tested**:
- `GET /analytics/dashboard`
- `GET /analytics/users/:id`

**Expected Bottlenecks**:
- Heavy aggregation queries
- Date range filtering
- Real-time calculations

**Optimization Targets**:
- Implement materialized views for common aggregations
- Use Redis for dashboard caching
- Consider pre-aggregation for historical data

### Scenario 5: Admin Operations (5%)

**Purpose**: Test admin-heavy queries and reports

**Endpoints Tested**:
- `GET /admin/stats`
- `GET /admin/escrows/pending?page=1&limit=50`
- `GET /audit/logs?page=1&limit=100&startDate=X&endDate=Y`

**Expected Bottlenecks**:
- Complex join queries for escrow data
- Large dataset queries for audit logs
- Aggregation queries for statistics

**Optimization Targets**:
- Add indexes on escrow status and dates
- Implement pagination for audit logs
- Cache admin statistics with TTL

## Installation & Setup

### Prerequisites

**Artillery**:
```bash
# Install globally
npm install -g artillery

# Verify installation
artillery version
```

**K6**:

Windows:
```powershell
choco install k6
```

Linux/macOS:
```bash
brew install k6
# or
sudo apt-get install k6
```

### Configuration

1. Copy the environment template:
```bash
cp load-testing/.env.load-test.example load-testing/.env.load-test
```

2. Edit configuration:
```env
TARGET_URL=http://localhost:3000
ENVIRONMENT=staging
K6_VUS=200
K6_DURATION=5m
```

3. Ensure your application is running:
```bash
npm run start:dev
```

## Running Tests

### Quick Start

**Artillery**:
```bash
# Windows
cd load-testing\scripts
run-artillery.bat http://localhost:3000

# Linux/macOS
cd load-testing/scripts
chmod +x run-artillery.sh
./run-artillery.sh --target http://localhost:3000
```

**K6**:
```bash
# Windows
cd load-testing\scripts
run-k6.bat http://localhost:3000

# Linux/macOS
cd load-testing/scripts
chmod +x run-k6.sh
./run-k6.sh --target http://localhost:3000
```

### Manual Execution

**Artillery**:
```bash
TARGET_URL=http://localhost:3000 artillery run \
  --output load-testing/reports/results.json \
  load-testing/artillery/load-test.yml

# Generate HTML report
artillery report load-testing/reports/results.json \
  --output load-testing/reports/report.html
```

**K6**:
```bash
TARGET_URL=http://localhost:3000 k6 run \
  --out json=load-testing/reports/k6-results.json \
  --summary-export=load-testing/reports/k6-summary.json \
  load-testing/k6/load-test.js
```

## Interpreting Results

### Key Metrics

#### Response Time Metrics

| Metric | Good | Acceptable | Poor | Action Required |
|--------|------|------------|------|-----------------|
| Average | < 500ms | 500-1000ms | > 1000ms | Optimize queries |
| P95 | < 1000ms | 1000-2000ms | > 2000ms | Add indexes |
| P99 | < 2000ms | 2000-5000ms | > 5000ms | Critical optimization |

#### Error Metrics

| Metric | Good | Acceptable | Poor | Action Required |
|--------|------|------------|------|-----------------|
| Error Rate | < 1% | 1-5% | > 5% | Investigate errors |
| 5xx Errors | 0 | < 1% | > 1% | Fix server issues |
| 4xx Errors | < 2% | 2-10% | > 10% | Review validation |

#### Throughput Metrics

| Metric | Good | Acceptable | Poor | Action Required |
|--------|------|------------|------|-----------------|
| RPS | > 100 | 50-100 | < 50 | Scale or optimize |
| Concurrent Users | 200+ | 100-200 | < 100 | Increase capacity |

### Bottleneck Identification

#### Database Bottlenecks

**Symptoms**:
- High P95/P99 latency on filtered queries
- Increasing response times over test duration
- Database CPU > 80%

**Solutions**:
```sql
-- Add indexes on frequently filtered columns
CREATE INDEX idx_products_category_price ON products(category_id, price);
CREATE INDEX idx_orders_buyer_created ON orders(buyer_id, created_at);
CREATE INDEX idx_products_stock_price ON products(in_stock, price);

-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM products WHERE category_id = 'X' AND price BETWEEN 10 AND 500;
```

#### Memory Bottlenecks

**Symptoms**:
- Increasing response times over test duration
- Memory usage > 85%
- Garbage collection pauses

**Solutions**:
```bash
# Increase Node.js heap size
NODE_OPTIONS="--max-old-space-size=4096" npm start

# Monitor memory usage
node --inspect app.js
# Use Chrome DevTools to profile memory
```

#### Connection Pool Bottlenecks

**Symptoms**:
- Sudden spike in errors at specific load
- "Connection pool exhausted" errors
- Database connection count at maximum

**Solutions**:
```typescript
// Increase connection pool size
{
  type: 'postgres',
  host: 'localhost',
  port: 5432,
  database: 'marketx',
  poolSize: 50, // Increase from default 10
  extra: {
    max: 50,
    min: 10,
    idleTimeoutMillis: 30000,
  }
}
```

## Performance Optimization

### Database Optimization

1. **Add Indexes**:
```sql
-- Product filtering
CREATE INDEX idx_products_filters ON products(category_id, price, in_stock);

-- Order queries
CREATE INDEX idx_orders_buyer ON orders(buyer_id);
CREATE INDEX idx_orders_status_created ON orders(status, created_at);

-- Analytics
CREATE INDEX idx_orders_created_amount ON orders(created_at, total_amount);
```

2. **Query Optimization**:
```typescript
// Before: N+1 query problem
const orders = await orderRepository.find();
for (const order of orders) {
  order.items = await orderItemRepository.find({ orderId: order.id });
}

// After: Use eager loading
const orders = await orderRepository.find({
  relations: ['items', 'buyer'],
});
```

3. **Implement Caching**:
```typescript
// Cache popular products
@Cacheable('products', 300) // 5 minutes TTL
async findPopularProducts() {
  return this.productRepository.find({
    where: { popularity: MoreThan(100) },
    take: 20,
  });
}
```

### Application Optimization

1. **Response Compression**:
```typescript
// Already implemented in main.ts
app.use(compression());
```

2. **Pagination**:
```typescript
// Enforce pagination limits
@Get()
async findAll(@Query() query: FilterDto) {
  const limit = Math.min(query.limit || 20, 100); // Max 100
  const page = query.page || 1;
  
  return this.service.findAll({ ...query, limit, page });
}
```

3. **Rate Limiting**:
```typescript
// Already implemented with dynamic throttler
@UseGuards(DynamicThrottlerGuard)
@Controller('products')
export class ProductsController {}
```

## CI/CD Integration

### GitHub Actions Workflow

Create `.github/workflows/load-test.yml`:

```yaml
name: Load Testing

on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM
  workflow_dispatch:
  pull_request:
    branches: [main, develop]

jobs:
  load-test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install K6
        run: |
          sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
          echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
          sudo apt-get update
          sudo apt-get install k6
      
      - name: Run Load Test
        env:
          TARGET_URL: ${{ secrets.STAGING_URL }}
        run: |
          k6 run \
            --out json=load-testing/reports/k6-results.json \
            --summary-export=load-testing/reports/k6-summary.json \
            load-testing/k6/load-test.js
      
      - name: Upload Results
        uses: actions/upload-artifact@v3
        with:
          name: load-test-results
          path: load-testing/reports/
      
      - name: Comment PR
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v6
        with:
          script: |
            const fs = require('fs');
            const summary = JSON.parse(fs.readFileSync('load-testing/reports/k6-summary.json'));
            const comment = `## Load Test Results
            
            - **Avg Response Time**: ${summary.metrics.http_req_duration.values.avg.toFixed(2)}ms
            - **P95 Response Time**: ${summary.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms
            - **Error Rate**: ${(summary.metrics.errors.values.rate * 100).toFixed(2)}%
            - **Total Requests**: ${summary.metrics.http_reqs.values.count}
            `;
            
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: comment
            });
```

## Troubleshooting

### Common Issues

#### Issue: High Error Rate

**Symptoms**: Error rate > 5%, many 5xx errors

**Diagnosis**:
```bash
# Check application logs
docker logs marketx-backend --tail 100

# Check database connections
docker exec -it postgres psql -U postgres -c "SELECT count(*) FROM pg_stat_activity;"

# Monitor system resources
docker stats
```

**Solutions**:
- Increase connection pool size
- Add error handling and retries
- Scale horizontally

#### Issue: Slow Response Times

**Symptoms**: P95 > 2000ms, P99 > 5000ms

**Diagnosis**:
```bash
# Enable query logging
# In TypeORM config
{
  logging: true,
  logger: 'advanced-console',
}

# Analyze slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

**Solutions**:
- Add database indexes
- Implement caching
- Optimize N+1 queries

#### Issue: Memory Leaks

**Symptoms**: Increasing memory usage over time

**Diagnosis**:
```bash
# Take heap snapshots
node --inspect app.js

# Use clinic.js
npm install -g clinic
clinic doctor -- node app.js
```

**Solutions**:
- Fix event listener leaks
- Clear caches periodically
- Optimize object creation

## Best Practices

1. **Always test in staging first**: Never run load tests against production without approval
2. **Monitor actively**: Watch metrics in real-time during tests
3. **Document findings**: Record baseline metrics and improvements
4. **Iterate**: Run tests after each optimization to validate improvements
5. **Share results**: Communicate findings with the team
6. **Automate**: Integrate load tests into CI/CD pipeline

## Resources

- [Artillery Documentation](https://www.artillery.io/docs)
- [K6 Documentation](https://k6.io/docs/)
- [Load Testing Best Practices](https://k6.io/docs/testing-guides/load-testing-best-practices/)
- [Database Performance Tuning](https://www.postgresql.org/docs/current/performance-tips.html)

---

**Last Updated**: 2026-03-30  
**Maintained By**: DevOps Team
