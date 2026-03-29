import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

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
    profile: any,
    done: VerifyCallback,
  ): Promise<void> {
    const { id, displayName, emails, photos } = profile;
    const email: string = emails?.[0]?.value ?? '';
    const name: string = displayName ?? '';
    const avatarUrl: string = photos?.[0]?.value ?? '';

    try {
      const jwt = await this.authService.findOrCreateOAuthUser({
        provider: 'google',
        providerId: id,
        email,
        name,
        avatarUrl,
      });
      done(null, { accessToken: jwt });
    } catch (err) {
      done(err as Error, false);
    }
  }
}
