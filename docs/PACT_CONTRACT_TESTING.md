# Pact Contract Testing Guide

## What is Contract Testing?

Contract testing is a technique for testing integrations between services (like frontend and backend) by checking that messages sent between them conform to a shared understanding documented in a "contract".

For MarketX, this means:
- **Frontend teams** define what they expect from the backend API
- **Backend team** verifies they meet those expectations
- **Breaking changes** are caught automatically before deployment

## The Problem We're Solving

### Before Pact Implementation

```
Backend Developer: "I'll rename 'productName' to 'name' for consistency"
                   *deploys to production*

Frontend Apps:      CRASH - Cannot read property 'productName'
                   
Teams:              Emergency hotfix needed!
                    Frantic coordination calls
                    Hours of downtime
```

### After Pact Implementation

```
Backend Developer: "I'll rename 'productName' to 'name'"
                   *creates PR*

CI/CD Pipeline:     Contract verification FAILED
                    Frontend expects 'productName' field
                    Breaking 3 consumer contracts

Backend Developer:  Adds backward compatibility
                   OR coordinates with frontend teams first
                   
Result:             No production incidents!
```

##  Quick Start

### 1. Verify Contracts Locally

```bash
# Terminal 1: Start the backend
npm run start:dev

# Terminal 2: Run contract verification
npm run pact:verify
```

### 2. Check Results

```bash
 Verifying a pact between MarketX-Web-Frontend and MarketX-Backend
   a request to get all products
   a request to get a specific product
   a request to create an order
   a request to get order details

All contracts verified successfully! 
```

##  Development Workflow

### For Backend Developers

#### Before Making API Changes

1. **Check existing contracts:**
   ```bash
   ls pact/contracts/
   # Review what frontends expect
   ```

2. **Make your changes**

3. **Verify contracts:**
   ```bash
   npm run pact:verify
   ```

4. **If verification fails:**
   - Review the error message
   - Add backward compatibility, OR
   - Coordinate with frontend teams

5. **Push your PR:**
   - CI/CD will verify automatically
   - PR will be blocked if contracts fail

#### Example: Safe API Change

```typescript
//  BREAKING CHANGE
export class ProductDto {
  id: string;
  productName: string;  // Renamed from 'name'
  price: number;
}

//  BACKWARD COMPATIBLE
export class ProductDto {
  id: string;
  name: string;              // Keep old field
  productName: string;       // Add new field
  price: number;
  
  constructor(data: any) {
    this.id = data.id;
    this.name = data.name;
    this.productName = data.name;  // Populate both
    this.price = data.price;
  }
}
```

### For Frontend Developers

#### Creating Consumer Contracts

Frontend teams write tests that generate contracts:

```javascript
// In your frontend test suite
import { PactV3 } from '@pact-foundation/pact';

const provider = new PactV3({
  consumer: 'MarketX-Web-Frontend',
  provider: 'MarketX-Backend',
});

describe('Product API', () => {
  it('gets a product by ID', async () => {
    await provider
      .given('a product with ID 123 exists')
      .uponReceiving('a request to get product 123')
      .withRequest({
        method: 'GET',
        path: '/products/123',
      })
      .willRespondWith({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: {
          id: '123',
          name: 'Product Name',
          price: 99.99,
          currency: 'USD',
          stock: 10,
        },
      });

    await provider.executeTest(async (mockServer) => {
      // Your actual API call
      const response = await api.getProduct('123');
      expect(response.name).toBe('Product Name');
    });
  });
});
```

#### Publishing Contracts

```bash
# After tests pass, publish to Pact Broker
npm run pact:publish
```

##  Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Pact Broker (Optional)                   │
│                  Centralized Contract Storage                │
└─────────────────────────────────────────────────────────────┘
           ▲                                    │
           │ Publish                   Fetch    │
           │ Contracts                Contracts │
           │                                    ▼
┌──────────────────────┐              ┌──────────────────────┐
│   Frontend Teams     │              │   Backend Team       │
│  (Consumers)         │              │   (Provider)         │
├──────────────────────┤              ├──────────────────────┤
│ • Web App            │              │ • MarketX-Backend    │
│ • Mobile App         │              │ • API Endpoints      │
│ • Admin Panel        │              │ • State Handlers     │
├──────────────────────┤              ├──────────────────────┤
│ Write consumer tests │              │ Verify contracts     │
│ Generate contracts   │              │ against actual API   │
│ Publish to broker    │              │ Publish results      │
└──────────────────────┘              └──────────────────────┘
```

##  Contract Structure

### Example Contract File

```json
{
  "consumer": { "name": "MarketX-Web-Frontend" },
  "provider": { "name": "MarketX-Backend" },
  "interactions": [
    {
      "description": "a request to get all products",
      "providerState": "products exist in the system",
      "request": {
        "method": "GET",
        "path": "/products",
        "query": "page=1&limit=10"
      },
      "response": {
        "status": 200,
        "headers": { "Content-Type": "application/json" },
        "body": {
          "data": [
            {
              "id": "uuid",
              "name": "string",
              "price": 99.99
            }
          ]
        }
      }
    }
  ]
}
```

### Key Components

1. **Consumer:** The frontend application
2. **Provider:** The backend API (MarketX-Backend)
3. **Interactions:** Expected request/response pairs
4. **Provider State:** Setup needed before the test
5. **Matching Rules:** Flexible matching (types, regex, etc.)

##  State Handlers

State handlers prepare your backend for each test scenario.

### Example State Handler

```typescript
// pact/state-handlers/product.state-handler.ts
export const productStateHandlers = {
  'a product with ID {id} exists': async (params) => {
    // Create test product in database
    await testDb.products.create({
      id: params.id,
      name: 'Test Product',
      price: 99.99,
      stock: 10,
    });
  },
  
  'no products exist': async () => {
    // Clear all products
    await testDb.products.deleteAll();
  },
};
```

### Best Practices for State Handlers

1. **Use test database:** Never modify production data
2. **Clean up:** Remove test data after verification
3. **Be idempotent:** Running twice should have same result
4. **Be fast:** Keep setup minimal
5. **Be isolated:** Don't depend on other tests

##  CI/CD Integration

### GitHub Actions Workflow

The workflow runs automatically on:
- Every pull request
- Pushes to main/develop branches
- Manual trigger

### What It Does

1.  Builds the application
2.  Sets up test database
3.  Starts the backend server
4.  Verifies all consumer contracts
5.  Publishes results to Pact Broker
6.  Comments on PR if contracts fail
7.  Blocks merge if verification fails

### PR Status Checks

```
 Pact Contract Verification
   All consumer contracts verified successfully
   
   Verified contracts:
   • MarketX-Web-Frontend (4 interactions)
   • MarketX-Mobile-App (3 interactions)
   • MarketX-Admin-Panel (2 interactions)
```

##  Debugging Failed Verifications

### Step 1: Read the Error

```bash
npm run pact:verify

# Output:
 Verifying a pact between MarketX-Web-Frontend and MarketX-Backend
   a request to get all products
   a request to get a specific product
  
  Expected response field 'productName' but got 'name'
  
  Expected:
  {
    "id": "123",
    "productName": "Test Product",  ← Frontend expects this
    "price": 99.99
  }
  
  Actual:
  {
    "id": "123",
    "name": "Test Product",          ← Backend returns this
    "price": 99.99
  }
```

### Step 2: Identify the Issue

- Field renamed? → Add backward compatibility
- Field removed? → Deprecate first, coordinate with frontend
- Type changed? → Version your API
- New required field? → Make it optional first

### Step 3: Fix It

```typescript
// Add backward compatibility
@Get(':id')
async getProduct(@Param('id') id: string) {
  const product = await this.productsService.findOne(id);
  
  return {
    id: product.id,
    name: product.name,           // New field
    productName: product.name,    // Old field (backward compatible)
    price: product.price,
  };
}
```

### Step 4: Verify Again

```bash
npm run pact:verify
#  All contracts verified!
```

##  Monitoring & Metrics

### Pact Broker Dashboard

If using Pact Broker, you can view:

- **Contract Matrix:** Which versions are compatible
- **Verification Status:** Pass/fail for each consumer
- **Deployment Safety:** Can I deploy this version?
- **Consumer Versions:** What's deployed where

### Key Metrics to Track

1. **Contract Verification Success Rate**
   - Target: 100% before merge
   
2. **Breaking Changes Caught**
   - How many incidents prevented
   
3. **Time to Detect Issues**
   - Seconds (in CI) vs hours (in production)

## 🎓 Best Practices

### DO 

- **Write contracts from consumer perspective**
- **Use flexible matching** (types, not exact values)
- **Keep contracts focused** (one interaction per test)
- **Version your APIs** when making breaking changes
- **Communicate with teams** before breaking changes
- **Run verification locally** before pushing

### DON'T 

- **Don't test business logic** (that's for unit tests)
- **Don't use production data** in state handlers
- **Don't make contracts too specific** (brittle tests)
- **Don't skip verification** ("it's probably fine")
- **Don't ignore failures** ("I'll fix it later")

##  Common Issues

### Issue: "State handler not found"

```bash
Error: No handler found for state: "a product exists"
```

**Solution:** Add the state handler:

```typescript
// pact/state-handlers/product.state-handler.ts
'a product exists': async () => {
  await setupTestProduct();
},
```

### Issue: "Connection refused"

```bash
Error: connect ECONNREFUSED 127.0.0.1:3000
```

**Solution:** Ensure backend is running:

```bash
npm run start:dev
# Wait for "Application started on port 3000"
```

### Issue: "Contract file not found"

```bash
Error: No pact files found in pact/contracts/
```

**Solution:** 
1. Check contract files exist
2. Or configure Pact Broker URL
3. Or get contracts from frontend team

##  Additional Resources

- [Pact Documentation](https://docs.pact.io/)
- [Consumer-Driven Contracts](https://martinfowler.com/articles/consumerDrivenContracts.html)
- [Pact Best Practices](https://docs.pact.io/implementation_guides/best_practices)
- [Pactflow](https://pactflow.io/) - Managed Pact Broker

##  Team Collaboration

### Communication Flow

1. **Frontend:** "We need a new field 'productCategory'"
2. **Backend:** "I'll add it in the next sprint"
3. **Frontend:** Updates contract with new field
4. **Backend:** Verification fails → implements the field
5. **Both:** Deploy independently with confidence!

### Regular Sync

- **Weekly:** Review contract changes
- **Before releases:** Verify all contracts pass
- **After incidents:** Update contracts to prevent recurrence

---

**Remember:** Contract testing is about enabling independent deployment while maintaining integration confidence. When in doubt, communicate! 
