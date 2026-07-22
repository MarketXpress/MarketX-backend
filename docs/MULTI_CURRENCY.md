# Multi-Currency Support

## Overview
MarketX now supports multi-currency pricing with automatic conversion based on real-time exchange rates.

## Features

### 1. USD as Source of Truth
All prices in the database are stored in USD. This ensures consistency and simplifies currency conversions.

### 2. Real-Time Exchange Rates
- Exchange rates are fetched from **Frankfurter API** (free, no API key required)
- Rates are cached in Redis for 4 hours
- Automatic refresh via cron job every 4 hours
- Fallback rates available if API is unavailable

### 3. Supported Currencies
- USD (US Dollar)
- EUR (Euro)
- GBP (British Pound)
- JPY (Japanese Yen)
- CAD (Canadian Dollar)
- AUD (Australian Dollar)
- CHF (Swiss Franc)
- CNY (Chinese Yuan)
- INR (Indian Rupee)
- XLM (Stellar Lumens)
- USDC (USD Coin)

### 4. Dynamic Price Conversion
Prices are automatically converted in API responses based on the `X-Currency` header.

## Usage

### Client-Side Implementation

```typescript
// Request products in GBP
const response = await fetch('/api/products', {
  headers: {
    'X-Currency': 'GBP'
  }
});

// Response will contain prices converted to GBP
{
  "id": "123",
  "name": "Product",
  "price": 79.00,
  "currency": "GBP",
  "originalPrice": 100.00,
  "originalCurrency": "USD"
}
```

### API Endpoints

#### Get Exchange Rates
```bash
GET /api/currency/rates
```

#### Convert Currency
```bash
POST /api/currency/convert
{
  "amount": 100,
  "from": "USD",
  "to": "EUR"
}
```

## Architecture

### Components

1. **ExchangeRateService**
   - Fetches rates from Frankfurter API
   - Caches rates in Redis
   - Provides fallback rates
   - Runs cron job every 4 hours

2. **CurrencyService**
   - Handles currency conversions
   - Uses cached exchange rates
   - Supports batch conversions

3. **CurrencyInterceptor**
   - Intercepts API responses
   - Automatically converts prices based on `X-Currency` header
   - Preserves original price information

### Data Flow

```
Client Request (X-Currency: GBP)
    ↓
CurrencyInterceptor
    ↓
ProductsController
    ↓
ProductsService (returns USD prices)
    ↓
CurrencyInterceptor (converts to GBP)
    ↓
Client Response (prices in GBP)
```

## Configuration

### Environment Variables

No additional environment variables required. The system uses:
- Existing Redis configuration
- Frankfurter API (no key needed)

### Cron Schedule

Exchange rates refresh every 4 hours:
```typescript
@Cron('0 */4 * * *')
```

## Testing

Run currency service tests:
```bash
npm test -- currency
```

## Migration

Run the migration to standardize existing prices:
```bash
npm run typeorm migration:run
```

## Error Handling

- If Frankfurter API fails, fallback rates are used
- If Redis is unavailable, rates are fetched directly
- Invalid currency codes return 400 Bad Request
- All conversions are logged for monitoring

## Performance

- Exchange rates cached in Redis (4-hour TTL)
- No database queries for conversions
- Minimal overhead on API responses
- Supports high-volume requests

## Future Enhancements

- User profile currency preference
- Historical exchange rate tracking
- Currency-specific rounding rules
- Multi-currency payment processing
