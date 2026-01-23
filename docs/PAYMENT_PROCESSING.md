# Payment Processing Module

A comprehensive Stellar network payment monitoring and processing system for MarketX marketplace. This module handles XLM and USDC payments, monitors the Stellar network for incoming transactions, verifies payment amounts, and automatically updates order statuses.

## Features

### Core Functionality
- **Payment Initiation**: Create pending payment records with destination wallet addresses
- **Real-time Monitoring**: Stream listener for Stellar network transactions using Horizon API
- **Payment Verification**: Validate incoming transactions against expected amounts and currencies
- **Automatic Order Updates**: Update order status to "PAID" upon payment confirmation
- **Payment Timeout Handling**: Automatically mark payments as timeout after expiration window
- **Multi-Currency Support**: Support for both XLM (native) and USDC (USDX) assets
- **Webhook Support**: Receive payment confirmations from external payment processors
- **Payment Statistics**: Aggregate payment data and statistics per buyer

### Payment Flow
```
Order (PENDING) 
    ↓
Initiate Payment → Create Payment Record (PENDING)
    ↓
Start Monitoring → Stream Stellar Transactions
    ↓
Transaction Detected → Verify Amount, Currency, Destination
    ↓
Verification Success → Update Payment (CONFIRMED) → Update Order (PAID)
    ↓
Verification Failed → Update Payment (FAILED)
```

## Architecture

### Services

#### PaymentsService
Main service for payment operations:
- `initiatePayment()` - Create pending payment for order
- `verifyAndConfirmPayment()` - Verify and confirm transaction
- `handlePaymentTimeout()` - Handle expired payments
- `getPaymentById()` - Retrieve payment details
- `getPaymentByOrderId()` - Find payment by associated order
- `getPaymentsByBuyerId()` - List all payments for buyer
- `getPaymentStats()` - Aggregate payment statistics

#### PaymentMonitorService
Stellar network monitoring service:
- `monitorPayment()` - Start streaming for payment address
- `stopMonitoringPayment()` - Stop monitoring and cleanup
- `isMonitoring()` - Check if payment is being monitored
- `getActiveStreamCount()` - Count active monitoring streams

**Lifecycle Hooks:**
- `onModuleInit()` - Initialize timeout monitoring, resume pending payments
- `onModuleDestroy()` - Cleanup all streams and intervals

### Entities

#### Payment Entity
```typescript
@Entity()
export class Payment {
  id: string;                           // UUID
  orderId: string;                      // Reference to Order
  amount: number;                       // Payment amount
  currency: PaymentCurrency;            // XLM or USDC
  status: PaymentStatus;                // pending, confirmed, failed, timeout, refunded
  stellarTransactionId?: string;        // Stellar transaction hash
  destinationWalletAddress: string;     // Buyer's wallet address
  sourceWalletAddress?: string;         // Sender's wallet address
  confirmationCount: number;            // Number of confirmations
  timeoutMinutes: number;               // Timeout duration
  expiresAt: Date;                      // Expiration timestamp
  failureReason?: string;               // Reason for failure
  stellarTransactionData?: JSON;        // Full Stellar transaction data
  buyerId: string;                      // Associated buyer
  createdAt: Date;
  updatedAt: Date;
  confirmedAt?: Date;
  failedAt?: Date;
}
```

### Database Indexes
- `orderId` - Fast lookup by order
- `stellarTransactionId` - Transaction tracking
- `destinationWalletAddress` - Stream-based monitoring
- `status` - Filter by payment status

## API Endpoints

### POST /payments/initiate
Initiate a payment for an order.

**Request:**
```json
{
  "orderId": "order-uuid",
  "currency": "XLM",
  "timeoutMinutes": 30
}
```

**Response:**
```json
{
  "id": "payment-uuid",
  "orderId": "order-uuid",
  "amount": 100.50,
  "currency": "XLM",
  "status": "pending",
  "destinationWalletAddress": "GBUQWP3BOUZX34...",
  "confirmationCount": 0,
  "createdAt": "2026-01-23T10:30:00Z",
  "expiresAt": "2026-01-23T11:00:00Z"
}
```

### GET /payments/:paymentId
Retrieve payment details.

**Response:**
```json
{
  "id": "payment-uuid",
  "orderId": "order-uuid",
  "amount": 100.50,
  "currency": "XLM",
  "status": "confirmed",
  "stellarTransactionId": "tx-hash",
  "destinationWalletAddress": "GBUQWP3BOUZX34...",
  "sourceWalletAddress": "GBUQWP3BOUZX34...",
  "confirmationCount": 1,
  "confirmedAt": "2026-01-23T10:35:00Z",
  "createdAt": "2026-01-23T10:30:00Z",
  "expiresAt": "2026-01-23T11:00:00Z"
}
```

### GET /payments/order/:orderId
Retrieve payment by associated order.

### GET /payments/buyer/:buyerId/stats
Get payment statistics for a buyer.

**Response:**
```json
{
  "totalPayments": 10,
  "confirmedCount": 8,
  "pendingCount": 1,
  "failedCount": 1,
  "timeoutCount": 0,
  "totalConfirmedAmount": 850.50
}
```

### POST /payments/webhook/stellar
Receive payment confirmations from Stellar network.

**Request:**
```json
{
  "transactionHash": "tx-hash",
  "sourceAccount": "GBUQWP3BOUZX34...",
  "destinationAccount": "GBUQWP3BOUZX34...",
  "amount": "100.50",
  "asset_code": "XLM",
  "ledger": 123456,
  "created_at": "2026-01-23T10:35:00Z"
}
```

### POST /payments/:paymentId/verify
Manually verify a payment transaction.

**Request:**
```json
{
  "id": "tx-hash",
  "source_account": "GBUQWP3BOUZX34...",
  "to": "GBUQWP3BOUZX34...",
  "amount": "100.50",
  "asset_code": "XLM",
  "created_at": "2026-01-23T10:35:00Z"
}
```

### GET /payments/monitor/status
Get payment monitor service status.

**Response:**
```json
{
  "activeStreams": 5
}
```

## Payment Status Enum

```typescript
enum PaymentStatus {
  PENDING = 'pending',       // Awaiting payment
  CONFIRMED = 'confirmed',   // Payment received and verified
  FAILED = 'failed',        // Payment validation failed
  TIMEOUT = 'timeout',      // Payment window expired
  REFUNDED = 'refunded'     // Payment refunded to sender
}
```

## Currency Support

```typescript
enum PaymentCurrency {
  XLM = 'XLM',     // Stellar Lumens
  USDC = 'USDC'    // USD Coin
}
```

## Configuration

### Environment Variables

```bash
# Stellar Network Configuration
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
STELLAR_NETWORK_PASSPHRASE=Test SDF Network ; September 2015

# Payment Timeout (minutes)
PAYMENT_TIMEOUT_MINUTES=30

# Stellar Asset Codes
USDC_ISSUER=GBBD47UZQ5MSUL3AJUP5FWVPTNZOZLW4HHVUMR5PBNSRTCTQAHFHVLQ
XLM_ISSUER=native
```

### Development vs Production

**Development (Testnet):**
```
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
STELLAR_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
```

**Production (Mainnet):**
```
STELLAR_HORIZON_URL=https://horizon.stellar.org
STELLAR_NETWORK_PASSPHRASE=Public Global Stellar Network ; September 2015
```

## Transaction Validation

The module performs strict validation on incoming transactions:

1. **Destination Address**: Must match payment's destination wallet
2. **Amount**: Must match payment amount (with 0.0001 tolerance)
3. **Asset/Currency**: Must match payment currency specification
4. **Age**: Transaction must not be older than payment timeout window

## Event Emitter

The module emits the following events:

```typescript
// When payment is initiated
'payment.initiated' - { paymentId, orderId, destinationAddress, expectedAmount, currency }

// When payment is confirmed
'payment.confirmed' - { paymentId, orderId, amount, currency, stellarTransactionId }

// When payment verification fails
'payment.failed' - { paymentId, orderId, reason }

// When payment stream detects confirmation
'payment.stream.confirmed' - { paymentId, transactionId }

// When payment times out
'payment.timeout' - { paymentId, orderId }
```

## Monitoring

### Active Stream Management
- Streams are automatically started when payment is initiated
- Streams are stopped when payment is confirmed or failed
- Expired streams are cleaned up periodically
- Module tracks up to hundreds of concurrent streams

### Timeout Management
- Every payment has a configurable timeout (default 30 minutes)
- Background job checks for expired payments every 5 minutes
- Expired payments are automatically marked as TIMEOUT status
- Associated orders remain in PENDING status

## Security Considerations

### Wallet Address Validation
- All destination addresses are verified against payment records
- Source addresses are logged for audit trail

### Transaction Verification
- Amount tolerance is minimal (0.0001 units)
- Asset codes are strictly matched
- Transaction age is validated

### Webhook Security (Recommended)
In production, implement:
- HMAC signature verification
- Timestamp validation
- IP whitelisting
- Rate limiting

## Error Handling

### Known Issues & Resolutions

**Payment Not Found:**
- Ensure orderId matches existing order
- Check if order is in PENDING status
- Verify wallet exists for buyer

**Transaction Verification Failed:**
- Verify correct wallet address used
- Check amount exactly matches expected
- Confirm asset code (XLM vs USDC)
- Check transaction is not older than timeout window

**Stream Connection Failed:**
- Verify Stellar Horizon URL is accessible
- Check network passphrase configuration
- Ensure wallet address is valid

## Testing

### Unit Tests
```bash
npm run test payments.service.spec.ts
npm run test payment-monitor.service.spec.ts
```

### E2E Tests
```bash
npm run test:e2e payments.e2e-spec.ts
```

### Test Coverage
- Payment creation and validation
- Transaction verification logic
- Timeout handling
- Stream monitoring lifecycle
- Event emission
- Error scenarios

## Usage Examples

### Initiating a Payment

```typescript
const paymentResponse = await paymentsService.initiatePayment({
  orderId: 'order-123',
  currency: PaymentCurrency.XLM,
  timeoutMinutes: 30
});

console.log(`Send payment to: ${paymentResponse.destinationWalletAddress}`);
console.log(`Amount: ${paymentResponse.amount} ${paymentResponse.currency}`);
```

### Handling Payment Confirmations

```typescript
// Listen for confirmed payment event
eventEmitter.on('payment.confirmed', async (data) => {
  console.log(`Payment ${data.paymentId} confirmed!`);
  console.log(`Stellar TX: ${data.stellarTransactionId}`);
  
  // Update user notification
  // Send order confirmation email
  // Trigger fulfillment process
});
```

### Monitoring Payment Status

```typescript
const payment = await paymentsService.getPaymentById('payment-123');
console.log(`Status: ${payment.status}`);
console.log(`Confirmations: ${payment.confirmationCount}`);
```

### Getting Buyer Statistics

```typescript
const stats = await paymentsService.getPaymentStats('buyer-123');
console.log(`Total confirmed payments: ${stats.confirmedCount}`);
console.log(`Total confirmed amount: ${stats.totalConfirmedAmount} XLM`);
```

## Performance Considerations

### Stream Efficiency
- One Horizon stream per payment (minimal resource usage)
- Streams automatically closed when payment completes
- Background job cleans up expired streams every 5 minutes

### Database Optimization
- Indexes on commonly queried fields
- Auto-delete cascade for related payments
- Timestamp-based expiration cleanup

### Scalability
- Supports thousands of concurrent payments
- Can handle high-frequency Stellar network queries
- Event-driven architecture for async processing

## Future Enhancements

- [ ] Payment retry mechanism with exponential backoff
- [ ] Multiple currency support (other Stellar assets)
- [ ] Refund processing and tracking
- [ ] Payment webhooks for external systems
- [ ] Advanced fraud detection
- [ ] Payment reconciliation reports
- [ ] Multi-signature wallet support
- [ ] Payment splitting for shared orders

## Troubleshooting

### Payment Stuck in PENDING
1. Check if monitor stream is active: `GET /payments/monitor/status`
2. Verify wallet address is correct: `GET /payments/:paymentId`
3. Check if transaction was sent to correct address
4. Verify Stellar network is accessible

### Transaction Not Detected
1. Ensure destination wallet matches payment destination
2. Verify amount is exact match
3. Check transaction is on correct Stellar network
4. Look for amount tolerance issues

### Stream Connection Issues
1. Verify Stellar Horizon URL in configuration
2. Check network connectivity
3. Validate wallet address format
4. Check service logs for connection errors

## References

- [Stellar Horizon API Documentation](https://developers.stellar.org/api)
- [Stellar JavaScript SDK](https://github.com/StellarCN/js-stellar-sdk)
- [Payment Operations](https://developers.stellar.org/docs/learn/fundamentals/transactions/operations-and-payments)
- [Streaming API](https://developers.stellar.org/api/introduction/streaming/)
