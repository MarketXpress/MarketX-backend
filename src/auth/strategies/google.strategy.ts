import { Injectable, BadRequestException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback, Profile } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';
import { createOAuthProfile, OAuthProvider } from '../types/oauth-profile.types';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    private readonly authService: AuthService,
    configService: ConfigService,
  ) {
    super({
      clientID: configService.get<string>('GOOGLE_CLIENT_ID')!,
      clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET')!,
      callbackURL: configService.get<string>('GOOGLE_CALLBACK_URL')!,
      scope: ['email', 'profile'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<void> {
    try {
      // Extract profile data from Google's response
      const { id, displayName, emails, photos } = profile;

      // Normalize email and name
      const email: string = emails?.[0]?.value ?? '';
      const name: string = displayName ?? 'Google User';
      const avatarUrl: string = photos?.[0]?.value;

      // Create a strictly typed OAuth profile contract
      const oauthProfile = createOAuthProfile(
        OAuthProvider.GOOGLE,
        id,
        email,
        name,
        avatarUrl,
      );

      // Pass to auth service for user creation/lookup
      const jwt = await this.authService.findOrCreateOAuthUser(oauthProfile);
      done(null, { accessToken: jwt });
    } catch (err) {
      done(
        err instanceof Error
          ? err
          : new BadRequestException('Google OAuth validation failed'),
      );
    }
  }
}
