import {
  OAuthProvider,
  isSupportedOAuthProvider,
  isValidOAuthProfile,
  validateOAuthProfile,
  createOAuthProfile,
  OAUTH_PROVIDER_CONFIG,
} from './oauth-profile.types';

describe('OAuth Profile Types and Validation', () => {
  describe('OAuthProvider enum', () => {
    it('should have GOOGLE provider', () => {
      expect(OAuthProvider.GOOGLE).toBe('google');
    });

    it('should have GITHUB provider', () => {
      expect(OAuthProvider.GITHUB).toBe('github');
    });
  });

  describe('isSupportedOAuthProvider', () => {
    it('should return true for supported providers', () => {
      expect(isSupportedOAuthProvider('google')).toBe(true);
      expect(isSupportedOAuthProvider('github')).toBe(true);
    });

    it('should return false for unsupported providers', () => {
      expect(isSupportedOAuthProvider('facebook')).toBe(false);
      expect(isSupportedOAuthProvider('twitter')).toBe(false);
      expect(isSupportedOAuthProvider('')).toBe(false);
    });

    it('should return false for non-string values', () => {
      expect(isSupportedOAuthProvider(null as any)).toBe(false);
      expect(isSupportedOAuthProvider(undefined as any)).toBe(false);
      expect(isSupportedOAuthProvider({} as any)).toBe(false);
    });
  });

  describe('isValidOAuthProfile', () => {
    it('should validate a complete valid profile', () => {
      const profile = {
        provider: 'google',
        providerId: 'google-123',
        email: 'user@example.com',
        name: 'John Doe',
        avatarUrl: 'https://example.com/avatar.jpg',
      };
      expect(isValidOAuthProfile(profile)).toBe(true);
    });

    it('should validate a profile without optional avatarUrl', () => {
      const profile = {
        provider: 'google',
        providerId: 'google-123',
        email: 'user@example.com',
        name: 'John Doe',
      };
      expect(isValidOAuthProfile(profile)).toBe(true);
    });

    it('should reject profile with invalid provider', () => {
      const profile = {
        provider: 'facebook',
        providerId: 'fb-123',
        email: 'user@example.com',
        name: 'John Doe',
      };
      expect(isValidOAuthProfile(profile)).toBe(false);
    });

    it('should reject profile with missing provider', () => {
      const profile = {
        providerId: 'google-123',
        email: 'user@example.com',
        name: 'John Doe',
      };
      expect(isValidOAuthProfile(profile)).toBe(false);
    });

    it('should reject profile with empty providerId', () => {
      const profile = {
        provider: 'google',
        providerId: '',
        email: 'user@example.com',
        name: 'John Doe',
      };
      expect(isValidOAuthProfile(profile)).toBe(false);
    });

    it('should reject profile with missing providerId', () => {
      const profile = {
        provider: 'google',
        email: 'user@example.com',
        name: 'John Doe',
      };
      expect(isValidOAuthProfile(profile)).toBe(false);
    });

    it('should reject profile with missing email', () => {
      const profile = {
        provider: 'google',
        providerId: 'google-123',
        name: 'John Doe',
      };
      expect(isValidOAuthProfile(profile)).toBe(false);
    });

    it('should reject profile with non-string email', () => {
      const profile = {
        provider: 'google',
        providerId: 'google-123',
        email: 123,
        name: 'John Doe',
      };
      expect(isValidOAuthProfile(profile)).toBe(false);
    });

    it('should reject profile with missing name', () => {
      const profile = {
        provider: 'google',
        providerId: 'google-123',
        email: 'user@example.com',
      };
      expect(isValidOAuthProfile(profile)).toBe(false);
    });

    it('should reject profile with empty name', () => {
      const profile = {
        provider: 'google',
        providerId: 'google-123',
        email: 'user@example.com',
        name: '',
      };
      expect(isValidOAuthProfile(profile)).toBe(false);
    });

    it('should reject profile with non-string name', () => {
      const profile = {
        provider: 'google',
        providerId: 'google-123',
        email: 'user@example.com',
        name: 123,
      };
      expect(isValidOAuthProfile(profile)).toBe(false);
    });

    it('should reject profile with invalid avatarUrl type', () => {
      const profile = {
        provider: 'google',
        providerId: 'google-123',
        email: 'user@example.com',
        name: 'John Doe',
        avatarUrl: 123,
      };
      expect(isValidOAuthProfile(profile)).toBe(false);
    });

    it('should reject null profile', () => {
      expect(isValidOAuthProfile(null)).toBe(false);
    });

    it('should reject undefined profile', () => {
      expect(isValidOAuthProfile(undefined)).toBe(false);
    });

    it('should reject non-object profile', () => {
      expect(isValidOAuthProfile('not an object')).toBe(false);
      expect(isValidOAuthProfile(123)).toBe(false);
    });
  });

  describe('validateOAuthProfile', () => {
    it('should not throw for valid profile', () => {
      const profile = {
        provider: 'google',
        providerId: 'google-123',
        email: 'user@example.com',
        name: 'John Doe',
      };
      expect(() => validateOAuthProfile(profile)).not.toThrow();
    });

    it('should throw for invalid provider', () => {
      const profile = {
        provider: 'facebook',
        providerId: 'fb-123',
        email: 'user@example.com',
        name: 'John Doe',
      };
      expect(() => validateOAuthProfile(profile)).toThrow('Invalid OAuth profile');
    });

    it('should throw for missing name', () => {
      const profile = {
        provider: 'google',
        providerId: 'google-123',
        email: 'user@example.com',
      };
      expect(() => validateOAuthProfile(profile)).toThrow('Invalid OAuth profile');
    });

    it('should throw for empty providerId', () => {
      const profile = {
        provider: 'google',
        providerId: '',
        email: 'user@example.com',
        name: 'John Doe',
      };
      expect(() => validateOAuthProfile(profile)).toThrow('Invalid OAuth profile');
    });
  });

  describe('createOAuthProfile', () => {
    it('should create a valid Google profile', () => {
      const profile = createOAuthProfile(
        OAuthProvider.GOOGLE,
        'google-123',
        'user@example.com',
        'John Doe',
        'https://example.com/avatar.jpg',
      );

      expect(profile).toEqual({
        provider: OAuthProvider.GOOGLE,
        providerId: 'google-123',
        email: 'user@example.com',
        name: 'John Doe',
        avatarUrl: 'https://example.com/avatar.jpg',
      });
    });

    it('should create a valid GitHub profile without avatar', () => {
      const profile = createOAuthProfile(
        OAuthProvider.GITHUB,
        'github-456',
        'dev@example.com',
        'Jane Dev',
      );

      expect(profile).toEqual({
        provider: OAuthProvider.GITHUB,
        providerId: 'github-456',
        email: 'dev@example.com',
        name: 'Jane Dev',
      });
    });

    it('should throw when creating with invalid provider', () => {
      expect(() =>
        createOAuthProfile(
          'facebook' as any,
          'fb-123',
          'user@example.com',
          'John Doe',
        ),
      ).toThrow();
    });

    it('should throw when creating with empty providerId', () => {
      expect(() =>
        createOAuthProfile(
          OAuthProvider.GOOGLE,
          '',
          'user@example.com',
          'John Doe',
        ),
      ).toThrow();
    });

    it('should throw when creating with empty name', () => {
      expect(() =>
        createOAuthProfile(
          OAuthProvider.GOOGLE,
          'google-123',
          'user@example.com',
          '',
        ),
      ).toThrow();
    });
  });

  describe('OAUTH_PROVIDER_CONFIG', () => {
    it('should have configuration for Google', () => {
      const config = OAUTH_PROVIDER_CONFIG[OAuthProvider.GOOGLE];
      expect(config.displayName).toBe('Google');
      expect(config.scope).toContain('email');
      expect(config.scope).toContain('profile');
    });

    it('should have configuration for GitHub', () => {
      const config = OAUTH_PROVIDER_CONFIG[OAuthProvider.GITHUB];
      expect(config.displayName).toBe('GitHub');
      expect(config.scope).toContain('user:email');
    });

    it('should have all supported providers configured', () => {
      const providers = Object.values(OAuthProvider);
      providers.forEach((provider) => {
        expect(OAUTH_PROVIDER_CONFIG[provider]).toBeDefined();
        expect(OAUTH_PROVIDER_CONFIG[provider].displayName).toBeTruthy();
        expect(OAUTH_PROVIDER_CONFIG[provider].scope).toBeTruthy();
        expect(Array.isArray(OAUTH_PROVIDER_CONFIG[provider].scope)).toBe(true);
      });
    });
  });
});
