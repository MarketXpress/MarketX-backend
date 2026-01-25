# Payment Processing Setup Guide

This guide helps developers set up and configure the payment processing module.

## Quick Start

### 1. Environment Configuration

Create or update your `.env` file with Stellar network configuration:

```bash
# .env (Development - Testnet)
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
STELLAR_NETWORK_PASSPHRASE=Test SDF Network ; September 2015

# .env.production (Production - Mainnet)
STELLAR_HORIZON_URL=https://horizon.stellar.org
STELLAR_NETWORK_PASSPHRASE=Public Global Stellar Network ; September 2015
```

### 2. Database Setup

The module uses TypeORM and requires the following tables (auto-created):

- `payment` - Stores payment records
- All related Order and Wallet tables (already existing)

### 3. Module Import

The PaymentsModule is already configured in `app.module.ts`:

```typescript
import { PaymentsModule } from './payments/payments.module';

@Module({
  imports: [
    // ... other modules
    PaymentsModule,
  ],
})
export class AppModule {}
```

### 4. Test the Integration

```bash
# Start the development server
npm run start:dev

# Run tests
npm run test payments.service.spec.ts
npm run test payment-monitor.service.spec.ts

# Run e2e tests
npm run test:e2e payments.e2e-spec.ts
```

## Stellar Wallet Setup

### Creating Test Wallets

For development, you'll need test wallets with XLM and USDC balances:

```bash
# 1. Visit Stellar Lab
# https://lab.stellar.org/

# 2. Create new accounts (Get a free test account)
# Stellar will provide:
# - Public Key: GBUQWP3BOUZX34ULNQG23RQ6F5DOBAB4NSTZDVSXTVWDNXMhtqc6VPM7
# - Secret Key: SBFQZ72DJFKX5Z6DZYQSQKQ7H6JLVVPDGMVXEWKFYPYJUXP5F5BH6XJ7

# 3. Fund your test account with 10,000 XLM

# 4. Add USDC trustline and get USDC:
# https://testnet.stellar.expert/
```

### Configuring Buyer Wallets

Buyer wallets are automatically created when a user is created. The wallet address is used as the payment destination:

```typescript
// User creates account
// Wallet automatically created with publicKey
// Use publicKey as destinationWalletAddress for payments

// In database:
// users table: id, email, etc.
// wallet table: id, userId, publicKey, secretKey (encrypted)
```

## Integration Points

### 1. Order Service Integration

When creating an order, it should be in PENDING status:

```typescript
// In orders.service.ts
const order = this.ordersRepository.create({
  totalAmount,
  status: OrderStatus.PENDING,  // Required!
  items,
  buyerId,
});
```

### 2. Payment Initiation Flow

```typescript
// In your controller/service:
import { PaymentsService } from 'src/payments/payments.service';

constructor(private paymentsService: PaymentsService) {}

async processOrder(orderId: string) {
  // 1. Create order (PENDING status)
  const order = await ordersService.create(createOrderDto);
  
  // 2. Initiate payment
  const payment = await paymentsService.initiatePayment({
    orderId: order.id,
    currency: PaymentCurrency.XLM,
    timeoutMinutes: 30
  });
  
  // 3. Return wallet address to user
  return {
    orderId: order.id,
    paymentAddress: payment.destinationWalletAddress,
    amount: payment.amount,
    currency: payment.currency,
    expiresAt: payment.expiresAt
  };
}
```

### 3. Event Listening

Listen for payment events:

```typescript
import { EventEmitter2 } from '@nestjs/event-emitter';

constructor(private eventEmitter: EventEmitter2) {}

onModuleInit() {
  // Payment confirmed
  this.eventEmitter.on('payment.confirmed', async (data) => {
    console.log(`Order ${data.orderId} paid with TX ${data.stellarTransactionId}`);
    // Update notification service
    // Start fulfillment process
  });
  
  // Payment failed
  this.eventEmitter.on('payment.failed', async (data) => {
    console.log(`Payment failed for order ${data.orderId}: ${data.reason}`);
    // Send user notification
    // Allow retry
  });
  
  // Payment timeout
  this.eventEmitter.on('payment.timeout', async (data) => {
    console.log(`Payment timeout for order ${data.orderId}`);
    // Send expiration notification
    // Allow re-initiation
  });
}
```

### 4. Webhook Handling (Optional)

For external payment processors:

```typescript
// External service sends payment notification
POST /payments/webhook/stellar
{
  "transactionHash": "...",
  "sourceAccount": "...",
  "destinationAccount": "...",
  "amount": "100.50",
  "asset_code": "XLM",
  "ledger": 123456,
  "created_at": "2026-01-23T10:35:00Z"
}
```

## Testing Payments

### Manual Testing with Stellar Lab

1. **Fund Test Account:**
   - Go to https://lab.stellar.org/
   - Create new account or use existing test account
   - Fund with 10,000 XLM

2. **Send Test Payment:**
   - Use Stellar Lab or Stellar CLI
   - Send XLM to destinationWalletAddress from PaymentInitiate response
   - Verify amount matches exactly

3. **Monitor Payment:**
   - Check `GET /payments/:paymentId` status
   - Should update to CONFIRMED within seconds
   - Order status should change to PAID

### Automated Testing

```bash
# Run unit tests with mocks
npm run test payments.service.spec.ts

# Run integration tests
npm run test:e2e payments.e2e-spec.ts
```

### Test Data Creation

Create test fixtures:

```typescript
// test/fixtures/payment.fixture.ts
export const createTestPayment = async (
  paymentsRepo: Repository<Payment>,
  orderId: string,
  buyerId: string
) => {
  return await paymentsRepo.save({
    orderId,
    buyerId,
    amount: 100,
    currency: PaymentCurrency.XLM,
    status: PaymentStatus.PENDING,
    destinationWalletAddress: 'GBUQWP3BOUZX34...',
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    timeoutMinutes: 30,
  });
};
```

## Monitoring and Debugging

### Check Active Streams

```bash
# Get monitor status
curl http://localhost:3000/payments/monitor/status

# Response:
# {"activeStreams": 5}
```

### View Payment Status

```bash
# Get payment details
curl http://localhost:3000/payments/payment-123

# Response:
# {
#   "id": "payment-123",
#   "orderId": "order-123",
#   "status": "pending",
#   "destinationWalletAddress": "GBUQWP3BOUZX34...",
#   ...
# }
```

### Enable Debug Logging

Update `main.ts`:

```typescript
import { Logger } from '@nestjs/common';

const app = await NestFactory.create(AppModule);
const logger = new Logger('PaymentDebug');

// Enable detailed payment logging
app.use((req, res, next) => {
  if (req.path.includes('/payments')) {
    logger.debug(`${req.method} ${req.path}`);
  }
  next();
});
```

## Production Deployment

### Pre-Production Checklist

- [ ] Test with real Stellar testnet
- [ ] Configure STELLAR_NETWORK_PASSPHRASE correctly
- [ ] Set up database backups
- [ ] Enable logging to persistent storage
- [ ] Configure error alerts
- [ ] Set up payment monitoring dashboard
- [ ] Test timeout handling
- [ ] Load test with concurrent payments

### Production Configuration

```bash
# .env.production
NODE_ENV=production
STELLAR_HORIZON_URL=https://horizon.stellar.org
STELLAR_NETWORK_PASSPHRASE=Public Global Stellar Network ; September 2015
DATABASE_URL=postgresql://user:password@prod-db-host/marketx_payments
LOG_LEVEL=info
PAYMENT_TIMEOUT_MINUTES=30
```

### Database Migration

```bash
# TypeORM will auto-create tables with autoLoadEntities=true
# For manual migration:
npm run typeorm migration:generate -- src/migrations/AddPaymentEntity
npm run typeorm migration:run
```

### Monitoring Setup

Configure application monitoring:

```typescript
// Set up payment success rate monitoring
this.eventEmitter.on('payment.confirmed', () => {
  metrics.paymentSuccess.inc();
});

this.eventEmitter.on('payment.failed', () => {
  metrics.paymentFailed.inc();
});

this.eventEmitter.on('payment.timeout', () => {
  metrics.paymentTimeout.inc();
});
```

## Troubleshooting

### Payment Not Updating

**Issue:** Payment remains in PENDING status after transaction is sent

**Solutions:**
1. Check if stream is active: `GET /payments/monitor/status`
2. Verify wallet address in payment matches destination
3. Check Stellar transaction was successfully confirmed
4. Verify Horizon URL is accessible
5. Check service logs for stream errors

### Transaction Not Found

**Issue:** "Payment not found for order" error

**Solutions:**
1. Ensure order exists and is in PENDING status
2. Check buyer has associated wallet
3. Verify orderId in request matches database

### Duplicate Payments

**Issue:** Multiple payments created for same order

**Solutions:**
1. PaymentsService checks for existing PENDING payments
2. If duplicate occurs, use latest payment only
3. Implement idempotency with order ID

## Performance Optimization

### Stream Resource Management

```typescript
// Monitor active streams
const streamCount = paymentMonitorService.getActiveStreamCount();
if (streamCount > 1000) {
  // Alert: Too many active streams
  // Check for stale streams
}
```

### Database Query Optimization

Add indexes (already configured):
- `orderId` - For order lookups
- `status` - For status queries
- `destinationWalletAddress` - For monitoring
- `stellarTransactionId` - For transaction tracking

### Batch Operations

For high-volume scenarios:

```typescript
// Check multiple payments at once
const payments = await paymentsRepository.find({
  where: { status: PaymentStatus.PENDING },
  take: 100,
});

for (const payment of payments) {
  if (payment.expiresAt < new Date()) {
    await paymentsService.handlePaymentTimeout(payment.id);
  }
}
```

## Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| Stream connection fails | Invalid Horizon URL | Check STELLAR_HORIZON_URL env var |
| Payment not verified | Amount mismatch | Ensure exact amount in transaction |
| Timeout not triggered | Job not running | Check ScheduleModule configuration |
| Duplicate streams | Multiple monitors | Implement singleton check |
| Memory leak | Unclosed streams | Ensure onModuleDestroy cleanup |

## Support Resources

- [Stellar Documentation](https://developers.stellar.org)
- [Horizon API Reference](https://developers.stellar.org/api)
- [JavaScript SDK](https://github.com/StellarCN/js-stellar-sdk)
- [NestJS Documentation](https://docs.nestjs.com)
