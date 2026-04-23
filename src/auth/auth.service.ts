import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { generateSecret, generateURI, verify } from 'otplib';
import * as qrcode from 'qrcode';
import { PrismaService } from '../prisma.service';
import { OAuthProfile, validateOAuthProfile } from './types/oauth-profile.types';
import {
  UserPasswordChangedEvent,
  AuthPasswordResetRequestedEvent,
  EventNames,
} from '../common/events';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly eventEmitter: EventEmitter2,
    private readonly redisService: RedisService,
    private readonly prisma: PrismaService,
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
    const user = {
      id: 'uuid-123',
      email: 'test@example.com',
      password: await bcrypt.hash('password123', 10),
    };

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
      throw new ForbiddenException(
        'Access Denied: Refresh token reuse detected.',
      );
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

  async enable2FA(userId: string) {
    const secret = generateSecret();

    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFASecret: secret, twoFAEnabled: true },
    });

    const otpauth = generateURI({
      issuer: 'MarketX',
      label: userId,
      secret,
    });
    const qrCodeDataURL = await qrcode.toDataURL(otpauth);

    return { qrCodeDataURL, otpauth };
  }

  async forgotPassword(email: string): Promise<void> {
    const resetUrl = `https://marketx.com/reset-password?token=mock-token-${Date.now()}`;

    this.eventEmitter.emit(
      EventNames.AUTH_PASSWORD_RESET_REQUESTED,
      new AuthPasswordResetRequestedEvent(email, 'User', resetUrl),
    );
  }

  async verify2FA(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.twoFAEnabled || !user.twoFASecret) {
      throw new BadRequestException('2FA not enabled for this user');
    }

    const result = await verify({
      secret: user.twoFASecret,
      token: code,
    });
    if (!result.valid) throw new BadRequestException('Invalid 2FA code');

    return true;
  }

  /**
   * Change user password with audit logging
   * Emits user.password_changed event for compliance tracking
   */
  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string,
    ipAddress: string,
    userAgent?: string,
  ): Promise<{ success: boolean }> {
    try {
      // Fetch user
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Verify old password
      const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
      if (!isPasswordValid) {
        // Emit failed audit event
        this.eventEmitter.emit(
          EventNames.USER_PASSWORD_CHANGED,
          new UserPasswordChangedEvent(
            'PASSWORD_CHANGE',
            userId,
            ipAddress,
            userAgent,
            'FAILURE',
            'Invalid current password',
            'user',
            userId,
            undefined,
            undefined,
            { reason: 'invalid_current_password' },
          ),
        );

        throw new BadRequestException('Invalid current password');
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update password
      await this.prisma.user.update({
        where: { id: userId },
        data: { password: hashedPassword },
      });

      // Emit successful audit event
      // Note: We intentionally don't store actual password values, only that a change occurred
      this.eventEmitter.emit(
        EventNames.USER_PASSWORD_CHANGED,
        new UserPasswordChangedEvent(
          'PASSWORD_CHANGE',
          userId,
          ipAddress,
          userAgent,
          'SUCCESS',
          undefined,
          'user',
          userId,
          { passwordChanged: false },
          { passwordChanged: true },
          {
            changedAt: new Date(),
            reason: 'user_initiated',
          },
        ),
      );

      return { success: true };
    } catch (error) {
      this.eventEmitter.emit(
        EventNames.USER_PASSWORD_CHANGED,
        new UserPasswordChangedEvent(
          'PASSWORD_CHANGE',
          userId,
          ipAddress,
          userAgent,
          'FAILURE',
          error.message,
          'user',
          userId,
          undefined,
          undefined,
          { reason: 'system_error' },
        ),
      );

      throw error;
    }
  }

  /**
   * Reset password (typically via email token)
   * Emits user.password_changed event for compliance tracking
   */
  async resetPassword(
    userId: string,
    newPassword: string,
    ipAddress: string,
    userAgent?: string,
  ): Promise<{ success: boolean }> {
    try {
      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update password
      await this.prisma.user.update({
        where: { id: userId },
        data: { password: hashedPassword },
      });

      // Emit successful audit event
      this.eventEmitter.emit(
        EventNames.USER_PASSWORD_CHANGED,
        new UserPasswordChangedEvent(
          'PASSWORD_CHANGE',
          userId,
          ipAddress,
          userAgent,
          'SUCCESS',
          undefined,
          'user',
          userId,
          { passwordReset: false },
          { passwordReset: true },
          {
            changedAt: new Date(),
            reason: 'password_reset',
          },
        ),
      );

      return { success: true };
    } catch (error) {
      this.eventEmitter.emit(
        EventNames.USER_PASSWORD_CHANGED,
        new UserPasswordChangedEvent(
          'PASSWORD_CHANGE',
          userId,
          ipAddress,
          userAgent,
          'FAILURE',
          error.message,
          'user',
          userId,
          undefined,
          undefined,
          { reason: 'system_error' },
        ),
      );

      throw error;
    }
  }

  /**
   * Find an existing user by email (or provider ID) and return a JWT,
   * or create a new user record if none exists, then return a JWT.
   *
   * Enforces strict typing via OAuthProfile contract.
   * Validates profile data before processing.
   *
   * @param profile - The OAuth profile (must conform to OAuthProfile contract)
   * @returns JWT token for the user
   * @throws BadRequestException if profile validation fails
   */
  async findOrCreateOAuthUser(profile: OAuthProfile): Promise<string> {
    // Validate profile against contract
    try {
      validateOAuthProfile(profile);
    } catch (error) {
      throw new BadRequestException(
        `Invalid OAuth profile: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }

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
