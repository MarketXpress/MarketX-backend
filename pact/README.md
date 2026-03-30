# Pact Contract Testing for MarketX-Backend

## Overview

This directory contains the Consumer-Driven Contract (CDC) testing implementation using [Pact](https://pact.io/) for the MarketX-Backend API. Contract testing ensures that changes to the backend API don't break frontend applications that depend on it.

##  Problem Solved

**Before Pact:**
- Backend developers rename API response fields → Frontend apps break globally
- No automated way to detect breaking changes before deployment
- Tight coordination required between backend and frontend teams
- Hotfixes needed after deployment when breaking changes are discovered

**After Pact:**
- Automated contract verification in CI/CD pipeline
- Breaking changes detected during PR review
- Frontend teams define their expectations as contracts
- Backend changes are validated against all consumer contracts
- Safe, independent deployment of services

## Directory Structure

```
pact/
├── README.md                          # This file
├── pact.config.ts                     # Central Pact configuration
├── provider-verifier.ts               # Provider verification script
├── contracts/                         # Consumer contract files
│   └── examples/                      # Example contracts
│       └── MarketX-Web-Frontend-MarketX-Backend.json
├── state-handlers/                    # Provider state setup
│   ├── index.ts                       # State handler registry
│   ├── product.state-handler.ts       # Product-related states
│   ├── order.state-handler.ts         # Order-related states
│   ├── user.state-handler.ts          # User-related states
│   └── payment.state-handler.ts       # Payment-related states
└── logs/                              # Verification logs (gitignored)
```

## 🚀 Quick Start

### 1. Install Dependencies

Dependencies are already installed via `npm install`. The key packages are:
- `@pact-foundation/pact` - Pact testing framework
- `@pact-foundation/pact-node` - Pact CLI tools

### 2. Run Provider Verification

Verify that the backend meets all consumer contracts:

```bash
# Start the backend application
npm run start:dev

# In another terminal, run verification
npm run pact:verify
```

### 3. Verify Specific Consumer

```bash
npm run pact:verify:consumer MarketX-Web-Frontend
```

## How It Works

### Consumer Side (Frontend)

1. **Frontend writes a contract** defining their expectations:
   ```javascript
   // In frontend codebase
   await provider
     .addInteraction({
       state: 'a product with ID 123 exists',
       uponReceiving: 'a request to get product 123',
       withRequest: {
         method: 'GET',
         path: '/products/123',
       },
       willRespondWith: {
         status: 200,
         body: {
           id: '123',
           name: 'Product Name',
           price: 99.99,
           // ... expected fields
         },
       },
     });
   ```

2. **Contract is published** to Pact Broker or shared as JSON file

### Provider Side (Backend - This Repo)

1. **Provider verification runs** against all consumer contracts
2. **State handlers** prepare the backend for each test scenario
3. **Actual API calls** are made to verify responses match contracts
4. **Results are published** back to Pact Broker

## Configuration

### Environment Variables

Create a `.env.pact` file or set these in your CI/CD:

```bash
# Pact Broker (optional - for centralized contract management)
PACT_BROKER_URL=https://your-pact-broker.com
PACT_BROKER_TOKEN=your-broker-token

# Provider details
PROVIDER_BASE_URL=http://localhost:3000
GIT_COMMIT=abc123
GIT_BRANCH=main

# Test authentication
PACT_TEST_AUTH_TOKEN=test-token-for-protected-endpoints

# Logging
PACT_LOG_LEVEL=info
```

### Pact Broker Setup (Optional but Recommended)

Using a Pact Broker centralizes contract management:

1. **Self-hosted:** Use [Pact Broker Docker](https://hub.docker.com/r/pactfoundation/pact-broker)
2. **Cloud:** Use [Pactflow](https://pactflow.io/) (managed service)

Benefits:
- Centralized contract storage
- Version history
- Can-I-Deploy checks
- Webhooks for CI/CD integration

## Writing State Handlers

State handlers prepare your backend for specific test scenarios. Example:

```typescript
// pact/state-handlers/product.state-handler.ts
export const productStateHandlers: Record<string, StateHandler> = {
  'a product with ID {id} exists': async (params?: { id: string }) => {
    // Setup: Create test product in database
    await testDatabase.products.create({
      id: params?.id,
      name: 'Test Product',
      price: 99.99,
      // ... other fields
    });
  },
  
  'no products exist': async () => {
    // Setup: Clear all products
    await testDatabase.products.deleteAll();
  },
};
```

##  CI/CD Integration

### GitHub Actions

The workflow `.github/workflows/pact-verification.yml` automatically:

1.  Runs on every PR and push to main/develop
2.  Builds the application
3.  Starts the backend server
4.  Verifies all consumer contracts
5.  Publishes results to Pact Broker
6.  Comments on PR if contracts fail
7.  Runs "can-i-deploy" check before production deployment

### Local PR Verification

Before pushing your PR:

```bash
# 1. Start your backend
npm run start:dev

# 2. Run contract verification
npm run pact:verify

# 3. If it passes, your changes are safe!
```

##  Example Contracts

### GET /products

```json
{
  "description": "a request to get all products",
  "providerState": "products exist in the system",
  "request": {
    "method": "GET",
    "path": "/products"
  },
  "response": {
    "status": 200,
    "body": {
      "data": [
        {
          "id": "uuid",
          "name": "string",
          "price": 99.99,
          "currency": "USD"
        }
      ]
    }
  }
}
```

### POST /orders

```json
{
  "description": "a request to create an order",
  "providerState": "user is authenticated",
  "request": {
    "method": "POST",
    "path": "/orders",
    "headers": {
      "Authorization": "Bearer token"
    },
    "body": {
      "productId": "uuid",
      "quantity": 2
    }
  },
  "response": {
    "status": 201,
    "body": {
      "id": "uuid",
      "status": "pending",
      "totalAmount": 199.98
    }
  }
}
```

##  Handling Breaking Changes

### When Verification Fails

1. **Review the failure:**
   ```bash
   npm run pact:verify
   # Check logs in pact/logs/
   ```

2. **Identify the breaking change:**
   - Field renamed? → Add alias or keep both temporarily
   - Field removed? → Deprecate first, remove later
   - Type changed? → Version your API

3. **Fix options:**
   - **Revert the change** if unintentional
   - **Update consumer contracts** if intentional (coordinate with frontend)
   - **Add backward compatibility** (recommended)

### Backward Compatibility Strategies

```typescript
// Breaking change
return {
  productName: product.name, // Renamed from 'name'
};

// Backward compatible
return {
  name: product.name,           // Keep old field
  productName: product.name,    // Add new field
};

// Later, after consumers update:
return {
  productName: product.name,    // Remove old field
};
```

## Monitoring & Reporting

### View Verification Results

```bash
# Check logs
cat pact/logs/pact-verification.log

# In CI/CD
# Results are uploaded as artifacts in GitHub Actions
```

### Pact Broker Dashboard

If using Pact Broker, view:
- Contract versions
- Verification status
- Consumer/Provider relationships
- Deployment readiness

##  Security Considerations

1. **Test Authentication:**
   - Use mock tokens for contract tests
   - Don't use production credentials
   - Set `PACT_TEST_AUTH_TOKEN` for protected endpoints

2. **Test Data:**
   - Use isolated test database
   - Clean up after tests
   - Don't expose sensitive data in contracts

3. **Pact Broker:**
   - Secure with authentication
   - Use HTTPS
   - Rotate tokens regularly

##  Workflow for Teams

### Frontend Team

1. Write consumer tests defining API expectations
2. Generate contract files
3. Publish to Pact Broker or share with backend team
4. Backend verification runs automatically

### Backend Team

1. Receive notification of new/updated contracts
2. Run verification locally: `npm run pact:verify`
3. If fails, fix breaking changes or coordinate with frontend
4. Push changes → CI/CD verifies automatically
5. Deploy with confidence!

##  Additional Resources

- [Pact Documentation](https://docs.pact.io/)
- [Pact Best Practices](https://docs.pact.io/implementation_guides/best_practices)
- [Consumer-Driven Contracts](https://martinfowler.com/articles/consumerDrivenContracts.html)
- [Pactflow](https://pactflow.io/) - Managed Pact Broker

##  Troubleshooting

### Verification Fails Locally

```bash
# Ensure backend is running
curl http://localhost:3000/health

# Check state handlers are working
# Review logs in pact/logs/

# Verify contract files exist
ls -la pact/contracts/
```

### CI/CD Failures

1. Check GitHub Actions logs
2. Verify environment variables are set
3. Ensure database migrations ran
4. Check application started successfully

### State Handler Issues

```typescript
// Add logging to debug
'a product exists': async (params) => {
  console.log('Setting up state:', params);
  // ... setup code
  console.log('State setup complete');
},
```

##  Support

For questions or issues:
1. Check this README
2. Review Pact documentation
3. Check CI/CD logs
4. Contact the backend team

---

**Remember:** Contract testing is about communication between teams. When in doubt, talk to your frontend colleagues! 
