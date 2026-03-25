import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { crypto } from 'crypto'; // Built-in Node module

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly eventEmitter: EventEmitter2,
    private readonly redisService: RedisService, // Inject your Redis provider here
  ) {}

  /**
   * Generates both AT and RT. 
   * The Refresh Token is a cryptographically secure random string.
   */
  async getTokens(userId: string, email: string) {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { sub: userId, email },
        { expiresIn: '15m' }, // Short-lived
      ),
      crypto.randomBytes(40).toString('hex'), // Long-lived random string
    ]);

    // Store RT in Redis with a TTL (e.g., 7 days)
    // Key pattern: refresh_token:user_id:token_value
    await this.redisService.set(
      `refresh_token:${userId}:${refreshToken}`,
      'active',
      604800, // 7 days in seconds
    );

    return { accessToken, refreshToken };
  }

  async validateUser(email: string, password: string): Promise<any> {
    // Mock user for demonstration (In production, fetch from DB)
    const user = { id: 'uuid-123', email: 'test@example.com', password: await bcrypt.hash('password123', 10) };

    if (user && (await bcrypt.compare(password, user.password))) {
      return this.getTokens(user.id, user.email);
    }
    throw new UnauthorizedException('Invalid credentials');
  }

  /**
   * Refreshes the Access Token and Rotates the Refresh Token
   */
  async refreshTokens(userId: string, email: string, oldRefreshToken: string) {
    const tokenKey = `refresh_token:${userId}:${oldRefreshToken}`;
    const tokenExists = await this.redisService.get(tokenKey);

    if (!tokenExists) {
      /**
       * REUSE DETECTION TRIGGERED
       * If the token isn't in Redis, it was either already used or is fake.
       * We invalidate all tokens for this user for safety.
       */
      await this.revokeAllUserTokens(userId);
      throw new ForbiddenException('Access Denied: Refresh token reuse detected.');
    }

    // Delete the used token (Rotation)
    await this.redisService.del(tokenKey);

    // Issue new pair
    return this.getTokens(userId, email);
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    const pattern = `refresh_token:${userId}:*`;
    const keys = await this.redisService.keys(pattern);
    if (keys.length > 0) {
      await this.redisService.del(...keys);
    }
  }

  async forgotPassword(email: string): Promise<void> {
    const resetUrl = `https://marketx.com/reset-password?token=mock-token-${Date.now()}`;
    
    this.eventEmitter.emit('auth.password_reset_requested', {
      email,
      name: 'User',
      resetUrl,
    });
  }
}