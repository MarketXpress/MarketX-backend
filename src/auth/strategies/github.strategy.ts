import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-github2';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

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
    profile: any,
    done: (err: any, user?: any) => void,
  ): Promise<void> {
    const { id, displayName, username, emails, photos } = profile;

    // GitHub may return emails as an array; pick the primary one
    const email: string =
      emails?.find((e: any) => e.primary)?.value ?? emails?.[0]?.value ?? '';

    const name: string = displayName ?? username ?? '';
    const avatarUrl: string = photos?.[0]?.value ?? '';

    try {
      const jwt = await this.authService.findOrCreateOAuthUser({
        provider: 'github',
        providerId: String(id),
        email,
        name,
        avatarUrl,
      });
      done(null, { accessToken: jwt });
    } catch (err) {
      done(err as Error);
    }
  }
}
