import { Injectable, BadRequestException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-github2';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';
import { createOAuthProfile, OAuthProvider } from '../types/oauth-profile.types';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(
    private readonly authService: AuthService,
    configService: ConfigService,
  ) {
    super({
      clientID: configService.get<string>('GITHUB_CLIENT_ID')!,
      clientSecret: configService.get<string>('GITHUB_CLIENT_SECRET')!,
      callbackURL: configService.get<string>('GITHUB_CALLBACK_URL')!,
      // Request email scope so GitHub returns the user's email addresses
      scope: ['user:email'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: (err: any, user?: any) => void,
  ): Promise<void> {
    try {
      // Extract profile data from GitHub's response
      const { id, displayName, username, emails, photos } = profile;

      // GitHub may return emails as an array; pick the primary one
      const email: string =
        emails?.find((e: any) => e.primary)?.value ?? emails?.[0]?.value ?? '';

      // Normalize name - prefer displayName, fall back to username
      const name: string = displayName ?? username ?? 'GitHub User';
      const avatarUrl: string | undefined = photos?.[0]?.value;

      // Create a strictly typed OAuth profile contract
      const oauthProfile = createOAuthProfile(
        OAuthProvider.GITHUB,
        String(id),
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
          : new BadRequestException('GitHub OAuth validation failed'),
      );
    }
  }
}
