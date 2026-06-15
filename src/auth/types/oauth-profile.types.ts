/**
 * OAuth Profile Types and Contracts
 *
 * This module defines strict typing for OAuth provider profiles
 * to ensure consistent handling of third-party authentication data.
 */

/**
 * Supported OAuth providers in the application
 */
export enum OAuthProvider {
  GOOGLE = 'google',
  GITHUB = 'github',
}

/**
 * Validates if a string is a supported OAuth provider
 */
export function isSupportedOAuthProvider(
  provider: string,
): provider is OAuthProvider {
  return Object.values(OAuthProvider).includes(provider as OAuthProvider);
}

/**
 * Core OAuth Profile Contract
 *
 * This interface defines the strict contract for OAuth user profiles.
 * All OAuth strategies must normalize their provider-specific data
 * into this contract before calling findOrCreateOAuthUser.
 *
 * Fields:
 * - provider: The OAuth provider identifier (google, github, etc.)
 * - providerId: The unique user ID from the OAuth provider
 * - email: The user's email address (may be empty for some providers)
 * - name: The user's display name
 * - avatarUrl: The user's profile picture URL (optional)
 */
export interface OAuthProfile {
  provider: OAuthProvider;
  providerId: string;
  email: string;
  name: string;
  avatarUrl?: string;
}

/**
 * Validates an OAuth profile object against the contract
 *
 * @param profile - The profile object to validate
 * @returns true if the profile is valid, false otherwise
 */
export function isValidOAuthProfile(profile: any): profile is OAuthProfile {
  if (!profile || typeof profile !== 'object') {
    return false;
  }

  // Validate required fields
  if (!isString(profile.provider) || !isSupportedOAuthProvider(profile.provider)) {
    return false;
  }

  if (!isString(profile.providerId) || profile.providerId.length === 0) {
    return false;
  }

  if (!isString(profile.email)) {
    return false;
  }

  if (!isString(profile.name) || profile.name.length === 0) {
    return false;
  }

  // Validate optional fields
  if (profile.avatarUrl !== undefined && !isString(profile.avatarUrl)) {
    return false;
  }

  return true;
}

/**
 * Validates an OAuth profile and throws a descriptive error if invalid
 *
 * @param profile - The profile object to validate
 * @throws Error with details about validation failure
 */
export function validateOAuthProfile(profile: any): asserts profile is OAuthProfile {
  if (!isValidOAuthProfile(profile)) {
    throw new Error(
      `Invalid OAuth profile: ${JSON.stringify({
        hasProvider: 'provider' in profile,
        hasProviderId: 'providerId' in profile,
        hasEmail: 'email' in profile,
        hasName: 'name' in profile,
        hasAvatarUrl: 'avatarUrl' in profile,
      })}`,
    );
  }
}

/**
 * Creates a typed OAuth profile from raw OAuth provider data
 *
 * This function ensures type safety when constructing profiles
 * from OAuth provider responses.
 *
 * @param provider - The OAuth provider
 * @param providerId - The user's ID from the provider
 * @param email - The user's email
 * @param name - The user's display name
 * @param avatarUrl - Optional user's profile picture URL
 * @returns A valid OAuthProfile
 * @throws Error if validation fails
 */
export function createOAuthProfile(
  provider: OAuthProvider,
  providerId: string,
  email: string,
  name: string,
  avatarUrl?: string,
): OAuthProfile {
  const profile: OAuthProfile = {
    provider,
    providerId,
    email,
    name,
    ...(avatarUrl && { avatarUrl }),
  };

  validateOAuthProfile(profile);
  return profile;
}

/**
 * Utility type guard for string validation
 */
function isString(value: any): value is string {
  return typeof value === 'string';
}

/**
 * OAuth Provider Configuration
 *
 * Metadata about each supported OAuth provider
 */
export const OAUTH_PROVIDER_CONFIG: Record<
  OAuthProvider,
  {
    displayName: string;
    scope: string[];
  }
> = {
  [OAuthProvider.GOOGLE]: {
    displayName: 'Google',
    scope: ['email', 'profile'],
  },
  [OAuthProvider.GITHUB]: {
    displayName: 'GitHub',
    scope: ['user:email'],
  },
};
