# OAuth Profile Contract Implementation

## Overview

This document describes the implementation of a strict, typed OAuth profile contract that ensures consistent handling of third-party authentication data across the application.

## Problem Statement

Previously, OAuth user creation flows in the authentication service referenced missing profile types and used loosely typed payloads (`any`). This created several risks:

1. **Type Safety**: No compile-time validation of OAuth profile structure
2. **Runtime Safety**: Malformed profiles could pass through to user creation
3. **Maintainability**: Unclear contract between strategies and auth service
4. **Developer Experience**: No IDE support or documentation for profile structure

## Solution

### 1. OAuth Profile Contract (`OAuthProfile` Interface)

A strict TypeScript interface that defines the required structure for all OAuth profiles:

```typescript
export interface OAuthProfile {
  provider: OAuthProvider;
  providerId: string;
  email: string;
  name: string;
  avatarUrl?: string;
}
```

**Fields:**

- **provider** (`OAuthProvider` enum): The OAuth provider identifier (google, github)
- **providerId** (`string`): The unique user ID from the OAuth provider
- **email** (`string`): The user's email address
- **name** (`string`): The user's display name
- **avatarUrl** (`string`, optional): The user's profile picture URL

### 2. Supported Providers

```typescript
export enum OAuthProvider {
  GOOGLE = 'google',
  GITHUB = 'github',
}
```

New providers can be added by:
1. Adding to the enum
2. Adding configuration to `OAUTH_PROVIDER_CONFIG`
3. Creating a new Passport strategy
4. Adding validation tests

### 3. Validation Functions

#### `isSupportedOAuthProvider(provider: string): provider is OAuthProvider`

Type guard that validates if a string is a supported OAuth provider:

```typescript
if (isSupportedOAuthProvider(provider)) {
  // provider is now known to be OAuthProvider type
}
```

#### `isValidOAuthProfile(profile: any): profile is OAuthProfile`

Type guard that validates an entire profile object:

```typescript
if (isValidOAuthProfile(profile)) {
  // profile is now known to be OAuthProfile type
}
```

#### `validateOAuthProfile(profile: any): asserts profile is OAuthProfile`

Assertion function that throws a descriptive error if validation fails:

```typescript
try {
  validateOAuthProfile(profile);
  // profile is now known to be OAuthProfile type
} catch (error) {
  // Handle validation error
}
```

#### `createOAuthProfile(...): OAuthProfile`

Factory function that creates and validates a profile in one step:

```typescript
const profile = createOAuthProfile(
  OAuthProvider.GOOGLE,
  'google-123',
  'user@example.com',
  'John Doe',
  'https://example.com/avatar.jpg',
);
```

### 4. Provider Configuration

Metadata about supported OAuth providers:

```typescript
export const OAUTH_PROVIDER_CONFIG = {
  google: {
    displayName: 'Google',
    scope: ['email', 'profile'],
  },
  github: {
    displayName: 'GitHub',
    scope: ['user:email'],
  },
};
```

## Implementation Details

### Auth Service (`findOrCreateOAuthUser` Method)

The method now enforces strict typing and validation:

```typescript
async findOrCreateOAuthUser(profile: OAuthProfile): Promise<string> {
  // Validate profile against contract
  try {
    validateOAuthProfile(profile);
  } catch (error) {
    throw new BadRequestException(
      `Invalid OAuth profile: ${error.message}`,
    );
  }

  const { provider, providerId, email, name, avatarUrl } = profile;
  // ... rest of implementation
}
```

**Benefits:**

- Compile-time type checking
- Runtime validation with descriptive errors
- Ensures only valid profiles reach user creation logic
- Prevents malformed data from being persisted

### Google Strategy

Normalizes Google's profile response and creates a typed profile:

```typescript
async validate(
  _accessToken: string,
  _refreshToken: string,
  profile: Profile,
  done: VerifyCallback,
): Promise<void> {
  try {
    const { id, displayName, emails, photos } = profile;
    
    const oauthProfile = createOAuthProfile(
      OAuthProvider.GOOGLE,
      id,
      emails?.[0]?.value ?? '',
      displayName ?? 'Google User',
      photos?.[0]?.value,
    );

    const jwt = await this.authService.findOrCreateOAuthUser(oauthProfile);
    done(null, { accessToken: jwt });
  } catch (err) {
    done(err instanceof Error ? err : new BadRequestException(...));
  }
}
```

**Key Changes:**

- Uses `createOAuthProfile` factory function
- Provides type-safe provider enum
- Better error handling with descriptive messages
- Handles optional fields gracefully

### GitHub Strategy

Similar normalization for GitHub profiles:

```typescript
async validate(
  _accessToken: string,
  _refreshToken: string,
  profile: Profile,
  done: (err: any, user?: any) => void,
): Promise<void> {
  try {
    const { id, displayName, username, emails, photos } = profile;
    
    // GitHub-specific email handling (primary email)
    const email = emails?.find((e: any) => e.primary)?.value ?? 
                  emails?.[0]?.value ?? '';
    
    const oauthProfile = createOAuthProfile(
      OAuthProvider.GITHUB,
      String(id),
      email,
      displayName ?? username ?? 'GitHub User',
      photos?.[0]?.value,
    );

    const jwt = await this.authService.findOrCreateOAuthUser(oauthProfile);
    done(null, { accessToken: jwt });
  } catch (err) {
    done(err instanceof Error ? err : new BadRequestException(...));
  }
}
```

## Testing

Comprehensive tests cover:

- Provider enum values
- Provider type guards
- Profile validation (valid and invalid cases)
- Optional field handling
- Error scenarios
- Factory function creation
- Provider configuration

### Running Tests

```bash
npm run test -- src/auth/types/oauth-profile.types.spec.ts
```

### Test Coverage

- Valid profiles with all fields
- Valid profiles without optional fields
- Invalid provider validation
- Missing required fields
- Invalid field types
- Null/undefined handling
- Factory function validation
- Provider configuration

## Migration Guide

### Before

```typescript
// Loosely typed, no validation
const jwt = await this.authService.findOrCreateOAuthUser({
  provider: 'google',
  providerId: id,
  email,
  name,
  avatarUrl,
});
```

### After

```typescript
// Strictly typed, validated
const oauthProfile = createOAuthProfile(
  OAuthProvider.GOOGLE,
  id,
  email,
  name ?? 'Google User',
  avatarUrl,
);
const jwt = await this.authService.findOrCreateOAuthUser(oauthProfile);
```

## Adding New OAuth Providers

To add a new provider (e.g., GitHub, LinkedIn):

### 1. Update the Enum

```typescript
export enum OAuthProvider {
  GOOGLE = 'google',
  GITHUB = 'github',
  NEW_PROVIDER = 'new-provider', // Add new provider
}
```

### 2. Add Configuration

```typescript
export const OAUTH_PROVIDER_CONFIG = {
  // ... existing
  new_provider: {
    displayName: 'New Provider',
    scope: ['email', 'profile'],
  },
};
```

### 3. Create Strategy

Import and use the types:

```typescript
import { createOAuthProfile, OAuthProvider } from '../types/oauth-profile.types';

export class NewProviderStrategy extends PassportStrategy(...) {
  async validate(...) {
    const oauthProfile = createOAuthProfile(
      OAuthProvider.NEW_PROVIDER,
      providerId,
      email,
      name,
      avatarUrl,
    );
    return this.authService.findOrCreateOAuthUser(oauthProfile);
  }
}
```

### 4. Add Tests

Update `oauth-profile.types.spec.ts` to test the new provider.

## Benefits

1. **Type Safety**: Full TypeScript compilation-time validation
2. **Runtime Safety**: Profile validation at service boundary
3. **Consistency**: All providers normalized to same contract
4. **Maintainability**: Clear interface for strategy-service communication
5. **Extensibility**: Easy to add new providers
6. **Documentation**: Self-documenting through types
7. **Error Handling**: Descriptive validation error messages

## Files Modified

- `src/auth/types/oauth-profile.types.ts` - New type definitions and validators
- `src/auth/types/oauth-profile.types.spec.ts` - Comprehensive test suite
- `src/auth/auth.service.ts` - Imported and uses typed profile
- `src/auth/strategies/google.strategy.ts` - Updated to use typed profile
- `src/auth/strategies/github.strategy.ts` - Updated to use typed profile

## Related Documentation

- [OAuth 2.0 Specification](https://tools.ietf.org/html/rfc6749)
- [Passport.js Documentation](http://www.passportjs.org/)
- [TypeScript Type Guards](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#using-type-predicates)
