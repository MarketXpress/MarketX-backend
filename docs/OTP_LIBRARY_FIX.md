# OTP Library Integration Fix

## Problem
The authentication module was using an outdated API for the `otplib` library. The code was importing from a non-existent `authenticator` object that doesn't exist in otplib version 13.4.0, causing runtime errors when trying to generate OTP secrets and verify TOTP codes.

## Root Cause
The otplib library underwent a significant API overhaul in version 13.x. The old API pattern:
```typescript
import { authenticator } from 'otplib';
authenticator.generateSecret();
authenticator.keyuri(...);
authenticator.verify({...});
```

This pattern is no longer valid. The library now exports functional APIs and class-based alternatives.

## Solution
Updated the codebase to use the correct otplib 13.4.0 API:

### Changes Made

#### 1. Updated Imports
**Before:**
```typescript
import { authenticator } from 'otplib';
```

**After:**
```typescript
import { generateSecret, generateURI, verify } from 'otplib';
```

#### 2. Fixed `enable2FA()` Method
**Before:**
```typescript
const secret = authenticator.generateSecret();
const otpauth = authenticator.keyuri(userId, 'YourAppName', secret);
```

**After:**
```typescript
const secret = generateSecret();
const otpauth = generateURI({
  issuer: 'MarketX',
  label: userId,
  secret,
});
```

**Key Changes:**
- `generateSecret()` is now a standalone function (no change in behavior)
- `keyuri()` method replaced with `generateURI()` with separate parameters
- Parameter structure changed from positional to object notation: `{issuer, label, secret}`

#### 3. Fixed `verify2FA()` Method
**Before:**
```typescript
const isValid = authenticator.verify({
  token: code,
  secret: user.twoFASecret,
});
if (!isValid) throw new BadRequestException('Invalid 2FA code');
```

**After:**
```typescript
const result = await verify({
  secret: user.twoFASecret,
  token: code,
});
if (!result.valid) throw new BadRequestException('Invalid 2FA code');
```

**Key Changes:**
- `verify()` is now async and must be awaited
- Returns a result object instead of a boolean: `{valid: boolean, delta?: number, ...}`
- Must check `result.valid` instead of the direct boolean value

## API Reference

### generateSecret(options?)
Generates a random Base32-encoded secret key.

```typescript
const secret = generateSecret();
// Returns: 'JBSWY3DPEHPK3PXP'
```

### generateURI(options)
Generates an otpauth:// URI for QR code generation.

```typescript
const uri = generateURI({
  issuer: 'MarketX',
  label: 'user@example.com',
  secret: 'JBSWY3DPEHPK3PXP',
});
// Returns: 'otpauth://totp/MarketX:user@example.com?secret=...'
```

### verify(options)
Verifies a TOTP token asynchronously.

```typescript
const result = await verify({
  secret: 'JBSWY3DPEHPK3PXP',
  token: '123456',
});
// Returns: {valid: true, delta: 0, epoch: 1234567890, timeStep: 12345}
```

## Testing
All OTP functionality has been verified:
- ✓ Secret generation
- ✓ QR code URI generation
- ✓ Token generation (synchronous and asynchronous)
- ✓ Token verification with valid tokens
- ✓ Token verification with invalid tokens
- ✓ Delta tolerance handling

## Files Modified
- `src/auth/auth.service.ts` - Updated imports and fixed `enable2FA()` and `verify2FA()` methods

## Backward Compatibility
This is a breaking change for the internal API but maintains the same external behavior:
- 2FA enablement still returns QR code and OTP auth URI
- 2FA verification still returns true/false success
- All error handling remains the same

## Further Reading
- otplib GitHub: https://github.com/yeojz/otplib
- otplib Documentation: https://otplib.yeojz.dev
- RFC 6238 (TOTP): https://tools.ietf.org/html/rfc6238
