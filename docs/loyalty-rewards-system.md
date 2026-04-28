# Tiered Loyalty & Rewards Program Engine

## Overview

The MarketX Tiered Loyalty & Rewards Program Engine is a comprehensive system designed to incentivize repeat purchases and reward high-value customers. The system implements a multi-tier loyalty program with points earning, redemption, and tier-based benefits.

## Features

### Core Features
- **Points Earning**: 10 points per $1 spent with tier multipliers
- **Tier System**: 5-tier loyalty program (Bronze, Silver, Gold, Platinum, Diamond)
- **Points Redemption**: Convert points to discount coupons or apply directly to checkout
- **Tier Benefits**: Progressive benefits including discounts, free shipping, and exclusive access
- **Birthday & Anniversary Bonuses**: Special bonus points for customer milestones
- **Real-time Tier Upgrades**: Automatic tier progression based on lifetime points

### Tier Benefits

#### Bronze Member (0-999 points)
- Points Multiplier: 1x
- Discount: 0%
- Free Shipping: $50+ orders
- Birthday Bonus: 50 points
- Anniversary Bonus: 25 points

#### Silver Member (1,000-4,999 points)
- Points Multiplier: 1.2x
- Discount: 5%
- Free Shipping: $35+ orders
- Birthday Bonus: 100 points
- Anniversary Bonus: 50 points
- Exclusive Access: Early sales, Silver events

#### Gold Member (5,000-14,999 points)
- Points Multiplier: 1.5x
- Discount: 10%
- Free Shipping: $25+ orders
- Birthday Bonus: 200 points
- Anniversary Bonus: 100 points
- Exclusive Access: Early sales, Silver & Gold events

#### Platinum Member (15,000-49,999 points)
- Points Multiplier: 2x
- Discount: 15%
- Free Shipping: All orders
- Birthday Bonus: 500 points
- Anniversary Bonus: 250 points
- Exclusive Access: All lower tier events + Platinum events

#### Diamond Member (50,000+ points)
- Points Multiplier: 2.5x
- Discount: 20%
- Free Shipping: All orders
- Birthday Bonus: 1,000 points
- Anniversary Bonus: 500 points
- Exclusive Access: All events + Diamond exclusive events

## API Endpoints

### Rewards Endpoints

#### Get User Balance
```http
GET /rewards/balance
Authorization: Bearer {token}
```

#### Get Rewards History
```http
GET /rewards/history
Authorization: Bearer {token}
```

#### Redeem Points for Coupon
```http
POST /rewards/redeem
Authorization: Bearer {token}
Content-Type: application/json

{
  "points": 100
}
```

#### Apply Points to Checkout
```http
POST /rewards/checkout
Authorization: Bearer {token}
Content-Type: application/json

{
  "pointsToUse": 100,
  "orderTotal": 50.00
}
```

#### Get Loyalty Summary
```http
GET /rewards/loyalty-summary
Authorization: Bearer {token}
```

#### Calculate Tier Discount
```http
POST /rewards/calculate-tier-discount
Authorization: Bearer {token}
Content-Type: application/json

{
  "orderTotal": 100.00
}
```

#### Check Free Shipping Eligibility
```http
POST /rewards/check-free-shipping
Authorization: Bearer {token}
Content-Type: application/json

{
  "orderTotal": 30.00
}
```

#### Grant Birthday Bonus
```http
POST /rewards/birthday-bonus
Authorization: Bearer {token}
```

#### Grant Anniversary Bonus
```http
POST /rewards/anniversary-bonus
Authorization: Bearer {token}
```

### Loyalty Management Endpoints (Admin Only)

#### Get All Tiers
```http
GET /loyalty/tiers
Authorization: Bearer {admin-token}
```

#### Create Loyalty Tier
```http
POST /loyalty/tiers
Authorization: Bearer {admin-token}
Content-Type: application/json

{
  "tierName": "platinum",
  "displayName": "Platinum Member",
  "description": "Elite status",
  "minPoints": 15000,
  "maxPoints": 49999,
  "benefits": {
    "pointsMultiplier": 2,
    "discountPercentage": 15,
    "freeShippingThreshold": 0,
    "exclusiveAccess": ["early_sales", "platinum_events"],
    "birthdayBonus": 500,
    "anniversaryBonus": 250
  },
  "color": "#E5E4E2",
  "sortOrder": 4
}
```

#### Update Loyalty Tier
```http
PUT /loyalty/tiers/{id}
Authorization: Bearer {admin-token}
Content-Type: application/json

{
  "displayName": "Updated Platinum Member",
  "benefits": {
    "pointsMultiplier": 2.2,
    "discountPercentage": 18
  }
}
```

#### Initialize Default Tiers
```http
POST /loyalty/initialize-default-tiers
Authorization: Bearer {admin-token}
```

## Database Schema

### Reward Points Entity
```sql
CREATE TABLE reward_points (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  points INTEGER NOT NULL,
  transaction_type VARCHAR(20) NOT NULL,
  description TEXT,
  reference_id UUID,
  reference_type VARCHAR(50),
  balance_after INTEGER NOT NULL,
  expires_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  deleted_at TIMESTAMP
);
```

### Loyalty Tiers Entity
```sql
CREATE TABLE loyalty_tiers (
  id UUID PRIMARY KEY,
  tier_name VARCHAR(20) UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  min_points INTEGER NOT NULL,
  max_points INTEGER,
  benefits JSONB NOT NULL,
  color VARCHAR(7) DEFAULT '#CD7F32',
  icon VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  deleted_at TIMESTAMP
);
```

### User Loyalty Tiers Entity
```sql
CREATE TABLE user_loyalty_tiers (
  id UUID PRIMARY KEY,
  user_id UUID UNIQUE NOT NULL,
  current_tier_id UUID NOT NULL,
  lifetime_points INTEGER DEFAULT 0,
  current_year_points INTEGER DEFAULT 0,
  tier_upgrade_date TIMESTAMP,
  months_at_current_tier INTEGER DEFAULT 0,
  tier_progress JSONB,
  earned_benefits JSONB,
  last_activity_date TIMESTAMP,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  deleted_at TIMESTAMP
);
```

## Event System

### Order Completed Event
The system automatically listens for `order.completed` events and:
1. Calculates base points (10 points per $1)
2. Applies tier multiplier
3. Updates user's loyalty tier points
4. Grants reward points to user account
5. Checks for tier upgrades

### Event Flow
```
Order Completed → Calculate Points → Apply Tier Multiplier → Update Loyalty Points → Grant Points → Check Tier Upgrade
```

## Integration Examples

### Frontend Integration

#### Display User Loyalty Status
```javascript
// Get user loyalty summary
const response = await fetch('/rewards/loyalty-summary', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const loyaltyData = await response.json();

// Display tier information
console.log(`Current Tier: ${loyaltyData.currentTierDisplayName}`);
console.log(`Lifetime Points: ${loyaltyData.lifetimePoints}`);
console.log(`Points to Next Tier: ${loyaltyData.tierProgress?.pointsToNextTier}`);
```

#### Apply Points at Checkout
```javascript
// Apply points to reduce order total
const applyPoints = async (pointsToUse, orderTotal) => {
  const response = await fetch('/rewards/checkout', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ pointsToUse, orderTotal })
  });
  
  const result = await response.json();
  
  // Update checkout UI
  updateCheckoutTotal(result.discountAmount);
  updatePointsBalance(result.remainingBalance);
};
```

#### Check Tier Benefits
```javascript
// Calculate tier discount for display
const calculateDiscount = async (orderTotal) => {
  const response = await fetch('/rewards/calculate-tier-discount', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ orderTotal })
  });
  
  const result = await response.json();
  return result.tierDiscount;
};
```

### Backend Integration

#### Custom Points Granting
```typescript
// Grant custom bonus points
await this.rewardsService.createReward({
  userId: 'user-123',
  points: 500,
  transactionType: PointsTransactionType.EARNED,
  description: 'Referral bonus',
  referenceId: 'referral-456',
  referenceType: 'referral'
});
```

#### Check User Eligibility
```typescript
// Check if user qualifies for special promotion
const userBalance = await this.rewardsService.getUserBalance(userId);
const userTier = await this.loyaltyService.getUserLoyaltyTier(userId);

if (userTier.currentTier.tierName === LoyaltyTierName.GOLD) {
  // Apply gold member benefits
}
```

## Configuration

### Environment Variables
```env
# Points Configuration
POINTS_PER_DOLLAR=10
POINTS_TO_DOLLAR_CONVERSION=100

# Loyalty Configuration
DEFAULT_TIER_INITIALIZATION=true
BIRTHDAY_BONUS_ENABLED=true
ANNIVERSARY_BONUS_ENABLED=true
```

## Testing

### Running Tests
```bash
# Run rewards tests
npm test -- rewards.service.spec.ts

# Run loyalty tests
npm test -- loyalty.service.spec.ts

# Run all rewards module tests
npm test -- src/rewards/
```

### Test Coverage
- Points earning and redemption
- Tier progression logic
- Event handling
- API endpoints
- Database operations

## Monitoring & Analytics

### Key Metrics
- Active loyalty program members
- Points issued vs redeemed ratio
- Tier distribution
- Redemption patterns
- Customer retention by tier

### Recommended Tracking
```typescript
// Track loyalty program performance
const loyaltyMetrics = {
  totalActiveMembers: await this.userLoyaltyTierRepository.count(),
  totalPointsIssued: await this.getTotalPointsIssued(),
  totalPointsRedeemed: await this.getTotalPointsRedeemed(),
  tierDistribution: await this.getTierDistribution(),
  redemptionRate: await this.calculateRedemptionRate()
};
```

## Security Considerations

### Points Fraud Prevention
- Rate limiting on redemption requests
- Audit trail for all point transactions
- Validation of order completion events
- Maximum redemption limits per transaction

### Tier Upgrade Validation
- Prevent manual tier manipulation
- Validate point calculations
- Log all tier changes
- Implement rollback mechanisms for errors

## Performance Optimization

### Database Indexing
- Index on user_id for fast lookups
- Index on created_at for history queries
- Composite indexes for complex queries

### Caching Strategy
- Cache user loyalty status
- Cache tier configurations
- Cache point balances for frequent access

## Troubleshooting

### Common Issues

#### Points Not Awarded
1. Check order.completed event is being emitted
2. Verify event listener is registered
3. Check user loyalty tier exists
4. Review logs for errors

#### Tier Not Upgrading
1. Verify lifetime points calculation
2. Check tier range definitions
3. Review tier upgrade logic
4. Check for database constraints

#### Redemption Failures
1. Verify user has sufficient balance
2. Check coupon generation limits
3. Review redemption rate limits
4. Check for concurrent redemption attempts

### Debug Commands
```bash
# Check user loyalty status
SELECT * FROM user_loyalty_tiers WHERE user_id = 'user-123';

# Review point transactions
SELECT * FROM reward_points WHERE user_id = 'user-123' ORDER BY created_at DESC;

# Check tier configurations
SELECT * FROM loyalty_tiers ORDER BY min_points;
```

## Future Enhancements

### Planned Features
- Points expiration system
- Referral bonus program
- Tier-downgrade protection
- Gamification elements
- Mobile app integration
- Advanced analytics dashboard

### Extension Points
- Custom tier benefits
- Additional earning methods
- Third-party integrations
- Advanced reporting
- A/B testing framework
