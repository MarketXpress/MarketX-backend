# Multi-Currency Quick Start

## What Was Implemented

✅ **USD as base currency** - All prices stored in USD in database  
✅ **Frankfurter API integration** - Real-time exchange rates (free, no API key)  
✅ **Redis caching** - Exchange rates cached for 4 hours  
✅ **Cron job** - Automatic refresh every 4 hours  
✅ **CurrencyInterceptor** - Automatic price conversion via X-Currency header  
✅ **11 currencies supported** - USD, EUR, GBP, JPY, CAD, AUD, CHF, CNY, INR, XLM, USDC

## How to Use

### 1. Start the Application
```bash
npm run start:dev
```

### 2. Request Products in Different Currency
```bash
# Get products in British Pounds
curl -H "X-Currency: GBP" http://localhost:3000/api/products

# Get products in Euros
curl -H "X-Currency: EUR" http://localhost:3000/api/products
```

### 3. Check Exchange Rates
```bash
curl http://localhost:3000/api/currency/rates
```

### 4. Convert Currency Directly
```bash
curl -X POST http://localhost:3000/api/currency/convert \
  -H "Content-Type: application/json" \
  -d '{"amount": 100, "from": "USD", "to": "GBP"}'
```

## Response Example

Request with `X-Currency: GBP`:
```json
{
  "id": "product-123",
  "name": "Sample Product",
  "price": 79.00,
  "currency": "GBP",
  "originalPrice": 100.00,
  "originalCurrency": "USD"
}
```

## Files Created

**Core:**
- `src/currency/` - Complete currency module
- `src/common/interceptors/currency.interceptor.ts` - Auto-conversion

**Tests:**
- `src/currency/*.spec.ts` - Unit tests
- `test/currency.e2e-spec.ts` - E2E tests

**Docs:**
- `docs/MULTI_CURRENCY.md` - Full documentation
- `CURRENCY_IMPLEMENTATION.md` - Implementation details

## Monitoring

Watch logs for exchange rate updates:
```
[ExchangeRateService] Fetching exchange rates from Frankfurter API...
[ExchangeRateService] Exchange rates updated: 11 currencies
```

## No Configuration Needed

The feature works out of the box using:
- Existing Redis configuration
- Free Frankfurter API (no key required)
- Automatic cron scheduling
