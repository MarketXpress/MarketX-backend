# Distributed Load Testing Workflows

## Overview

This directory contains comprehensive load testing configurations for the MarketX Backend API using both **Artillery** and **K6**. These tests are designed to simulate 200 virtual users hitting heavy query endpoints over concentrated 5-minute durations to identify performance bottlenecks, memory capacity limits, and latency dropoffs.

## Purpose

- **Identify Concurrent Threshold Capabilities**: Determine the exact concurrent user capacity of the current Node.js instance
- **Visualize Performance Bottlenecks**: Map stress nodes and identify logical software bottlenecks
- **Memory Capacity Analysis**: Outline peak memory capacity and latency dropoffs
- **Drive Indexing Decisions**: Provide hard evidence to support critical future database indexing discussions

## Test Scenarios

The load tests simulate realistic user behavior with weighted traffic patterns:

| Scenario | Weight | Description |
|----------|--------|-------------|
| **Product Search & Filter** | 40% | Heavy queries with multiple filters, sorting, pagination, and price history |
| **Order Queries** | 30% | Order listing with buyer filters and status queries |
| **Category Navigation** | 15% | Nested category queries with product listings |
| **Analytics Queries** | 10% | Dashboard aggregations and user analytics |
| **Admin Operations** | 5% | Heavy admin queries including escrows and audit logs |

## Directory Structure

```
load-testing/
├── artillery/
│   ├── load-test.yml          # Artillery configuration
│   └── processor.js            # Custom Artillery functions
├── k6/
│   └── load-test.js            # K6 test script
├── scripts/
│   ├── run-artillery.sh        # Artillery execution script
│   ├── run-k6.sh               # K6 execution script
│   └── analyze-results.sh      # Results analysis script
├── reports/                    # Generated test reports
├── .env.load-test.example      # Environment configuration template
└── README.md                   # This file
```

## Prerequisites

### Artillery Installation

```bash
# Install Artillery globally
npm install -g artillery

# Or use npx (no installation required)
npx artillery@latest
```

### K6 Installation

**Windows:**
```powershell
# Using Chocolatey
choco install k6

# Or download from https://k6.io/docs/getting-started/installation/
```

**Linux/macOS:**
```bash
# Using Homebrew
brew install k6

# Or using package manager
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

## Configuration

### 1. Environment Setup

Copy the example environment file and configure for your target:

```bash
cp .env.load-test.example .env.load-test
```

Edit `.env.load-test` with your configuration:

```env
TARGET_URL=http://localhost:3000
ENVIRONMENT=staging
K6_VUS=200
K6_DURATION=5m
```

### 2. Target Environment

Ensure your target environment is running and accessible:

```bash
# For local testing, start your application
npm run start:dev

# Verify the application is running
curl http://localhost:3000
```

## Running Load Tests

### Artillery Tests

#### Quick Start

```bash
# Run with default configuration
TARGET_URL=http://localhost:3000 artillery run load-testing/artillery/load-test.yml

# Run with HTML report generation
TARGET_URL=http://localhost:3000 artillery run \
  --output load-testing/reports/artillery-results.json \
  load-testing/artillery/load-test.yml

# Generate HTML report from results
artillery report load-testing/reports/artillery-results.json \
  --output load-testing/reports/artillery-report.html
```

#### Using the Helper Script

```bash
# Make script executable (Linux/macOS)
chmod +x load-testing/scripts/run-artillery.sh

# Run the test
./load-testing/scripts/run-artillery.sh

# Windows (using Git Bash or WSL)
bash load-testing/scripts/run-artillery.sh
```

#### Advanced Options

```bash
# Run with custom target
TARGET_URL=https://staging.marketx.com artillery run load-testing/artillery/load-test.yml

# Run with increased load
artillery run \
  --overrides '{"config":{"phases":[{"duration":300,"arrivalRate":300}]}}' \
  load-testing/artillery/load-test.yml

# Run with environment variables
artillery run \
  --dotenv .env.load-test \
  load-testing/artillery/load-test.yml
```

### K6 Tests

#### Quick Start

```bash
# Run with default configuration
TARGET_URL=http://localhost:3000 k6 run load-testing/k6/load-test.js

# Run with JSON output
TARGET_URL=http://localhost:3000 k6 run \
  --out json=load-testing/reports/k6-results.json \
  load-testing/k6/load-test.js

# Run with InfluxDB output (for Grafana visualization)
TARGET_URL=http://localhost:3000 k6 run \
  --out influxdb=http://localhost:8086/k6 \
  load-testing/k6/load-test.js
```

#### Using the Helper Script

```bash
# Make script executable (Linux/macOS)
chmod +x load-testing/scripts/run-k6.sh

# Run the test
./load-testing/scripts/run-k6.sh

# Windows (using Git Bash or WSL)
bash load-testing/scripts/run-k6.sh
```

#### Advanced Options

```bash
# Run with custom VUs and duration
TARGET_URL=http://localhost:3000 k6 run \
  --vus 300 \
  --duration 10m \
  load-testing/k6/load-test.js

# Run with specific stage configuration
TARGET_URL=http://localhost:3000 k6 run \
  --stage 1m:50,5m:200,1m:0 \
  load-testing/k6/load-test.js

# Run with custom thresholds
TARGET_URL=http://localhost:3000 k6 run \
  --threshold http_req_duration=p(95)<1500 \
  load-testing/k6/load-test.js
```

## Understanding Results

### Key Metrics to Monitor

#### Response Time Metrics
- **Average Response Time**: Should be < 1000ms
- **P95 (95th Percentile)**: Should be < 2000ms
- **P99 (99th Percentile)**: Should be < 5000ms

#### Error Metrics
- **Error Rate**: Should be < 5%
- **HTTP 5xx Errors**: Indicates server-side issues
- **HTTP 4xx Errors**: May indicate rate limiting or validation issues

#### Throughput Metrics
- **Requests per Second (RPS)**: Total request throughput
- **Data Transfer**: Network bandwidth usage
- **Concurrent Connections**: Active connection count

#### Resource Metrics
- **Memory Usage**: Monitor for memory leaks or capacity limits
- **CPU Usage**: Identify CPU-bound operations
- **Database Connections**: Monitor connection pool saturation

### Artillery Report Analysis

Artillery generates detailed HTML reports with:

1. **Summary Statistics**: Overall test performance
2. **Response Time Distribution**: Histogram of response times
3. **Request Rate**: Requests per second over time
4. **Error Rate**: Percentage of failed requests
5. **Scenario Breakdown**: Performance by scenario

**Key Sections to Review:**
```
- Summary: Overall pass/fail status
- Latency: p50, p95, p99 percentiles
- Errors: Error count and types
- Codes: HTTP status code distribution
```

### K6 Report Analysis

K6 provides real-time console output and JSON reports:

**Console Output:**
```
✓ status is 200
✓ response has body
✓ response time < 3000ms

checks.........................: 95.00% ✓ 2850  ✗ 150
data_received..................: 45 MB  150 kB/s
data_sent......................: 2.5 MB 8.3 kB/s
http_req_duration..............: avg=850ms  p(95)=1800ms p(99)=4200ms
http_reqs......................: 3000   10/s
```

**Key Metrics:**
- `http_req_duration`: Response time statistics
- `http_req_failed`: Failed request percentage
- `http_reqs`: Total requests and rate
- `checks`: Validation check pass rate

## Performance Bottleneck Identification

### Common Bottlenecks

1. **Database Query Performance**
   - Symptoms: High P95/P99 latency on filtered queries
   - Solution: Add database indexes, optimize queries

2. **Memory Pressure**
   - Symptoms: Increasing response times over test duration
   - Solution: Optimize memory usage, increase heap size

3. **Connection Pool Exhaustion**
   - Symptoms: Sudden spike in errors at specific load
   - Solution: Increase connection pool size

4. **Rate Limiting**
   - Symptoms: HTTP 429 errors
   - Solution: Adjust rate limits or implement backoff

5. **CPU Saturation**
   - Symptoms: Linear increase in response time with load
   - Solution: Optimize CPU-intensive operations, scale horizontally

### Analysis Workflow

1. **Run Initial Test**: Establish baseline performance
2. **Identify Bottlenecks**: Review metrics and error patterns
3. **Monitor Resources**: Check CPU, memory, database metrics
4. **Optimize**: Apply fixes (indexing, caching, etc.)
5. **Re-test**: Validate improvements
6. **Document**: Record findings and optimizations

## Integration with Monitoring

### Grafana + InfluxDB

```bash
# Start monitoring stack
docker-compose -f docker-compose.monitoring.yml up -d

# Run K6 with InfluxDB output
TARGET_URL=http://localhost:3000 k6 run \
  --out influxdb=http://localhost:8086/k6 \
  load-testing/k6/load-test.js

# Access Grafana dashboard
open http://localhost:3000
```

### Prometheus Integration

```bash
# K6 with Prometheus remote write
TARGET_URL=http://localhost:3000 k6 run \
  --out experimental-prometheus-rw \
  load-testing/k6/load-test.js
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Load Testing

on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM
  workflow_dispatch:

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Install K6
        run: |
          sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
          echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
          sudo apt-get update
          sudo apt-get install k6
      
      - name: Run Load Test
        env:
          TARGET_URL: ${{ secrets.STAGING_URL }}
        run: k6 run load-testing/k6/load-test.js
      
      - name: Upload Results
        uses: actions/upload-artifact@v3
        with:
          name: load-test-results
          path: load-testing/reports/
```

## Best Practices

### Before Testing

1. **Notify Team**: Inform team members before running load tests
2. **Use Staging**: Never run load tests against production without approval
3. **Baseline Metrics**: Capture baseline performance before testing
4. **Monitor Resources**: Set up monitoring before starting tests

### During Testing

1. **Monitor Actively**: Watch metrics in real-time
2. **Check Logs**: Monitor application logs for errors
3. **Resource Monitoring**: Track CPU, memory, database metrics
4. **Be Ready to Stop**: Have a kill switch ready if issues arise

### After Testing

1. **Analyze Results**: Review all metrics and identify bottlenecks
2. **Document Findings**: Record performance characteristics
3. **Create Action Items**: List optimizations needed
4. **Share Results**: Communicate findings with team
5. **Archive Reports**: Save reports for historical comparison

## Troubleshooting

### Common Issues

**Issue: Connection Refused**
```bash
# Check if application is running
curl http://localhost:3000

# Check port availability
netstat -an | grep 3000
```

**Issue: High Error Rate**
```bash
# Check application logs
docker logs marketx-backend

# Check database connections
docker exec -it postgres psql -U postgres -c "SELECT count(*) FROM pg_stat_activity;"
```

**Issue: Memory Errors**
```bash
# Increase Node.js heap size
NODE_OPTIONS="--max-old-space-size=4096" npm start

# Monitor memory usage
docker stats marketx-backend
```

## Advanced Scenarios

### Custom Test Scenarios

Create custom scenarios by modifying the configuration files:

**Artillery:**
```yaml
scenarios:
  - name: "Custom Heavy Query"
    weight: 50
    flow:
      - get:
          url: "/custom-endpoint?param=value"
```

**K6:**
```javascript
export default function() {
  const response = http.get(`${TARGET_URL}/custom-endpoint`);
  check(response, {
    'status is 200': (r) => r.status === 200,
  });
}
```

### Distributed Testing

Run tests from multiple machines for higher load:

```bash
# Machine 1
TARGET_URL=http://staging.com k6 run --vus 100 load-testing/k6/load-test.js

# Machine 2
TARGET_URL=http://staging.com k6 run --vus 100 load-testing/k6/load-test.js
```

## Results Interpretation Guide

### Acceptable Performance Ranges

| Metric | Good | Acceptable | Poor |
|--------|------|------------|------|
| Avg Response Time | < 500ms | 500-1000ms | > 1000ms |
| P95 Response Time | < 1000ms | 1000-2000ms | > 2000ms |
| P99 Response Time | < 2000ms | 2000-5000ms | > 5000ms |
| Error Rate | < 1% | 1-5% | > 5% |
| Throughput | > 100 RPS | 50-100 RPS | < 50 RPS |

### When to Scale

Consider scaling when:
- P95 response time > 2000ms consistently
- Error rate > 5%
- CPU usage > 80% sustained
- Memory usage > 85% sustained
- Database connection pool > 90% utilized

## Support and Resources

- **Artillery Documentation**: https://www.artillery.io/docs
- **K6 Documentation**: https://k6.io/docs/
- **Project Issues**: Create an issue in the repository
- **Team Contact**: Reach out to the DevOps team

## License

This load testing suite is part of the MarketX Backend project.

---

**Last Updated**: 2026-03-30
**Maintained By**: DevOps Team
