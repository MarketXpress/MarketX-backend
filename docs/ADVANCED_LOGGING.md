# Advanced Logging Guide

## Table of Contents
1. [Decorators](#decorators)
2. [Performance Monitoring](#performance-monitoring)
3. [Correlation IDs](#correlation-ids)
4. [Custom Transports](#custom-transports)
5. [Log Aggregation](#log-aggregation)
6. [Troubleshooting](#troubleshooting)

## Decorators

### ExecutionTime Decorator

Automatically logs method execution time and flags slow operations.

```typescript
import { ExecutionTime } from './common/decorators/execution-time.decorator';

@Injectable()
export class UserService {
  constructor(private logger: LoggerService) {}

  @ExecutionTime()
  async createUser(userData: CreateUserDto) {
    // Automatically logged with execution time
    return await this.userRepository.save(userData);
  }

  @ExecutionTime()
  async findAll() {
    // This will be logged as slow if it takes > 1000ms
    return await this.userRepository.find();
  }
}
```

**Output:**
```
2026-01-23 14:30:46 [DEBUG] [UserService] createUser - Started { context: { class: 'UserService', method: 'createUser' } }
2026-01-23 14:30:46 [DEBUG] [UserService] createUser - Completed { duration: '45ms', context: { ... } }
2026-01-23 14:30:47 [WARN] [UserService] findAll - Completed (SLOW) { duration: '1250ms', context: { ... } }
```

### LogExecution Decorator

Similar to ExecutionTime but with custom metadata.

```typescript
import { LogExecution } from './common/decorators/execution-time.decorator';

@Injectable()
export class OrderService {
  constructor(private logger: LoggerService) {}

  @LogExecution({ component: 'OrderService', action: 'process_payment' })
  async processPayment(orderId: string, amount: number) {
    // Logged with custom component and action
  }

  @LogExecution({ component: 'OrderService', action: 'create_shipment' })
  async createShipment(orderId: string) {
    // Another tracked operation with custom metadata
  }
}
```

### LogQuery Decorator

Logs database operations with query details.

```typescript
import { LogQuery } from './common/decorators/query-log.decorator';

@Injectable()
export class ProductService {
  constructor(private logger: LoggerService) {}

  @LogQuery()
  async findProductsByCategory(categoryId: string) {
    return await this.productRepository.find({ where: { categoryId } });
  }

  @LogQuery()
  async searchProducts(query: string) {
    return await this.productRepository.query(
      'SELECT * FROM products WHERE name ILIKE $1',
      [`%${query}%`]
    );
  }
}
```

## Performance Monitoring

### Using PerformanceMonitor Class

Track and analyze performance metrics with detailed statistics.

```typescript
import { PerformanceMonitor } from './common/logger/performance-monitor';

@Injectable()
export class ComplexService {
  private monitor: PerformanceMonitor;

  constructor(private logger: LoggerService) {
    this.monitor = new PerformanceMonitor(logger, {
      slowThreshold: 1000,
      warningThreshold: 500,
    });
  }

  async processLargeDataset(data: any[]) {
    return await this.monitor.track('process-dataset', async () => {
      // Your expensive operation
      const result = await this.expensiveComputation(data);
      return result;
    }, { itemCount: data.length });
  }

  async syncWithExternalAPI() {
    return await this.monitor.track('api-sync', async () => {
      return await this.externalAPIClient.sync();
    }, { service: 'external-api' });
  }

  // Get performance statistics
  printStatistics() {
    this.monitor.logStatistics('process-dataset');
    this.monitor.logStatistics(); // Print all
  }
}
```

**Output:**
```
2026-01-23 14:35:22 [INFO] Performance Statistics: process-dataset {
  operationName: 'process-dataset',
  count: 150,
  successCount: 148,
  failureCount: 2,
  successRate: '98.67%',
  min: '45ms',
  max: '2150ms',
  avg: '450.32ms',
  p95: '890ms',
  p99: '1200ms'
}
```

### Manual Performance Measurement

```typescript
@Injectable()
export class DataProcessingService {
  constructor(private logger: LoggerService) {}

  async processData(items: any[]) {
    const monitor = new PerformanceMonitor(this.logger);

    // Measure specific operation
    const measurement = monitor.measure('batch-processing', { itemCount: items.length });

    try {
      // Do work
      for (const item of items) {
        await this.processItem(item);
      }
      measurement.end(true); // Success
    } catch (error) {
      measurement.end(false); // Failure
      throw error;
    }
  }
}
```

### Batch Performance Tracking

Track performance of batch operations.

```typescript
import { BatchPerformanceTracker } from './common/logger/performance-monitor';

@Injectable()
export class BatchService {
  constructor(private logger: LoggerService) {}

  async processBatch(items: any[]) {
    const tracker = new BatchPerformanceTracker(this.logger);
    tracker.start('batch-import');

    for (const item of items) {
      const startTime = Date.now();
      
      try {
        await this.processItem(item);
        const duration = Date.now() - startTime;
        tracker.recordItem('batch-import', duration);
      } catch (error) {
        tracker.recordItem('batch-import', Date.now() - startTime);
      }
    }

    tracker.report('batch-import');
    // Output: Batch Report with min, max, avg, total times
  }
}
```

## Correlation IDs

### Automatic Correlation ID Tracking

The system automatically generates and tracks correlation IDs for distributed tracing.

```typescript
// Request with correlation ID header
GET /api/users
x-correlation-id: 550e8400-e29b-41d4-a716-446655440000

// Response includes correlation ID
x-correlation-id: 550e8400-e29b-41d4-a716-446655440000
```

### Using Correlation IDs in Services

```typescript
import { CorrelationIdHelper } from './common/middleware/correlation-id.middleware';

@Injectable()
export class UserService {
  constructor(
    private logger: LoggerService,
    private httpService: HttpService,
  ) {}

  async getUser(userId: string, @Req() request: Request) {
    const correlationId = CorrelationIdHelper.getFromRequest(request);

    this.logger.info('Fetching user', {
      userId,
      correlationId,
    });

    // Pass correlation ID to external services
    const headers = CorrelationIdHelper.createHeaders(correlationId);
    
    return await this.httpService.get(
      `https://api.external.com/users/${userId}`,
      { headers }
    ).toPromise();
  }
}
```

### Distributed Tracing with Multiple Services

```typescript
// Service A calls Service B
@Controller('orders')
export class OrderController {
  constructor(
    private logger: LoggerService,
    private orderService: OrderService,
  ) {}

  @Post()
  async create(@Body() dto: CreateOrderDto, @Req() request: Request) {
    const correlationId = (request as any).correlationId;

    this.logger.info('Order creation initiated', { correlationId });

    return this.orderService.create(dto, correlationId);
  }
}

// Service B continues the trace
@Injectable()
export class OrderService {
  constructor(
    private logger: LoggerService,
    private paymentService: PaymentService,
  ) {}

  async create(dto: CreateOrderDto, correlationId: string) {
    this.logger.info('Creating order in database', { correlationId });

    // Service B calls Service C with same correlation ID
    const payment = await this.paymentService.process(
      dto.paymentInfo,
      correlationId
    );

    this.logger.info('Order created successfully', { correlationId });
  }
}

// Service C completes the trace
@Injectable()
export class PaymentService {
  constructor(private logger: LoggerService) {}

  async process(paymentInfo: any, correlationId: string) {
    this.logger.info('Processing payment', { correlationId });

    const result = await this.externalPaymentGateway.charge(paymentInfo);

    this.logger.info('Payment completed', { correlationId, result });

    return result;
  }
}
```

## Custom Transports

### Adding Datadog Transport

```typescript
// In logger.service.ts

import * as DatadogTransport from 'datadog-winston';

// Add to transports array:
new DatadogTransport({
  apiKey: process.env.DATADOG_API_KEY,
  host: 'localhost',
  port: 10516,
  ddsource: 'nodejs',
  ddtags: `env:${process.env.NODE_ENV}`,
})
```

### Adding Elasticsearch Transport

```typescript
import WinstonElasticsearch from 'winston-elasticsearch';

// Add to transports array:
new WinstonElasticsearch({
  level: 'info',
  clientOpts: {
    node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
  },
  index: 'marketx-logs',
})
```

### Adding CloudWatch Transport

```typescript
import WinstonCloudWatch from 'winston-cloudwatch';

// Add to transports array:
new WinstonCloudWatch({
  logGroupName: '/aws/lambda/marketx-api',
  logStreamName: process.env.NODE_ENV,
  awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
  awsSecretKey: process.env.AWS_SECRET_ACCESS_KEY,
  awsRegion: process.env.AWS_REGION,
  messageFormatter: (logEvent) => {
    return `[${logEvent.level}] ${logEvent.message}`;
  },
})
```

## Log Aggregation

### ELK Stack (Elasticsearch, Logstash, Kibana)

#### 1. Configure Logstash

Create `logstash.conf`:
```conf
input {
  file {
    path => "/path/to/logs/combined-*.log"
    start_position => "beginning"
    codec => json
  }
}

filter {
  json {
    source => "message"
  }
}

output {
  elasticsearch {
    hosts => ["localhost:9200"]
    index => "marketx-logs-%{+YYYY.MM.dd}"
  }
}
```

#### 2. Create Kibana Dashboard

Query in Kibana:
```json
{
  "query": {
    "bool": {
      "must": [
        { "match": { "level": "ERROR" } },
        { "range": { "timestamp": { "gte": "now-24h" } } }
      ]
    }
  }
}
```

### Splunk Integration

#### 1. Add Splunk Transport

```typescript
import SplunkHttpEventCollector from 'winston-splunk-hec';

new SplunkHttpEventCollector({
  token: process.env.SPLUNK_HEC_TOKEN,
  host: process.env.SPLUNK_HEC_HOST,
  port: process.env.SPLUNK_HEC_PORT || 8088,
  protocol: 'https',
  path: '/services/collector',
  max_content_length_logs: 2000000,
  max_content_length_metrics: 1000000,
})
```

#### 2. Query in Splunk

```
index=marketx level=ERROR | stats count by message | sort - count
```

## Troubleshooting

### Issue: Logs not appearing in external service

**Solution:**
1. Verify transport is properly configured
2. Check network connectivity to external service
3. Verify credentials and API keys
4. Check firewall rules
5. Enable debug logging to see transport errors

```typescript
// Add to logger configuration
logger.on('error', (error) => {
  console.error('Logger error:', error);
});
```

### Issue: Performance logs are too noisy

**Solution:**
- Increase slow threshold in PerformanceMonitor
- Filter debug logs in production (set LOG_LEVEL=info or warn)
- Use log sampling for high-traffic endpoints

```typescript
const monitor = new PerformanceMonitor(logger, {
  slowThreshold: 5000, // Increase threshold
  warningThreshold: 2000,
});
```

### Issue: High memory usage from cached metrics

**Solution:**
- Clear metrics periodically
- Reduce in-memory metric retention
- Archive metrics to external storage

```typescript
// Clear old metrics periodically
setInterval(() => {
  monitor.clearMetrics();
}, 3600000); // Every hour
```

### Issue: Sensitive data still appearing in logs

**Solution:**
1. Add field name to SENSITIVE_KEYS array
2. Use custom redaction function
3. Verify data is being serialized correctly

```typescript
// In logger.service.ts, add to SENSITIVE_KEYS:
const SENSITIVE_KEYS = [
  'password',
  'apiKey',
  'customSensitiveField', // Add your field
];
```

## Best Practices

1. **Always use correlation IDs** for distributed tracing
2. **Test redaction** with your actual data
3. **Monitor log file sizes** in production
4. **Use appropriate log levels** (error for failures, info for important events)
5. **Include context** in every log message
6. **Rotate logs** to prevent disk space issues
7. **Set up alerts** for critical errors
8. **Archive logs** for long-term storage and compliance
9. **Review logs regularly** for patterns and issues
10. **Use performance monitoring** to identify bottlenecks
