import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { UsersService } from '../users/users.service';

export interface OAuthProfile {
  provider: string;
  providerId: string;
  email: string;
  name: string;
  avatarUrl?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly eventEmitter: EventEmitter2,
    private readonly usersService: UsersService,
  ) {}

  async validateUser(email: string, password: string): Promise<string> {
    // Mock user for demonstration purposes
    const user = { email: 'test@example.com', password: await bcrypt.hash('password123', 10) };

    if (user && (await bcrypt.compare(password, user.password))) {
      return this.jwtService.sign({ email: user.email });
    }
    throw new UnauthorizedException('Invalid credentials');
  }

  async forgotPassword(email: string): Promise<void> {
    const resetUrl = `https://marketx.com/reset-password?token=mock-token-${Date.now()}`;

    this.eventEmitter.emit('auth.password_reset_requested', {
      email,
      name: 'User',
      resetUrl,
    });
  }

  /**
   * Find an existing user by email (or provider ID) and return a JWT,
   * or create a new user record if none exists, then return a JWT.
   */
  async findOrCreateOAuthUser(profile: OAuthProfile): Promise<string> {
    const { provider, providerId, email, name, avatarUrl } = profile;

    // 1. Try to find by email first (link social login to existing account)
    let user = email ? await this.usersService.findByEmail(email) : null;

    if (!user) {
      // 2. No existing account — create a new one
      user = await this.usersService.create({
        email,
        name,
        password: null,
        avatarUrl: avatarUrl ?? undefined,
        oauthProvider: provider,
        oauthProviderId: providerId,
      });
    }

    // 3. Sign and return the standard JWT
    return this.jwtService.sign({ sub: user.id, email: user.email });
  }
}